#requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ArticleJsonPath,
    [Parameter(Mandatory)][string]$OutputDirectory,
    [string]$UpdateMediaId,
    [string]$ExpectedDraftSnapshot
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$VerbosePreference = 'SilentlyContinue'
$DebugPreference = 'SilentlyContinue'
$InformationPreference = 'SilentlyContinue'
$script:stage = 'local_validation'
$script:failureReason = 'local_validation_error'
$script:apiErrorCode = $null
$script:accessToken = $null
$script:journal = $null
$lockStream = $null
$secureSecret = $null
$secret = $null
$exitCode = 2

function Stop-Safe {
    param([string]$Reason)
    $script:failureReason = $Reason
    throw [InvalidOperationException]::new('Draft operation stopped; consult the safe result.')
}

function Write-AtomicJson {
    param([string]$Path, $Value)
    $temporary = $Path + '.' + [guid]::NewGuid().ToString('N') + '.tmp'
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($Value | ConvertTo-Json -Depth 20))
    $stream = [IO.File]::Open($temporary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
    [IO.File]::Move($temporary, $Path, $true)
}

function Save-Journal {
    $script:journal.updated_at = [DateTimeOffset]::Now.ToString('o')
    Write-AtomicJson -Path $script:journalPath -Value $script:journal
}

function Resolve-ArticleFile {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { Stop-Safe 'missing_article_file' }
    if (-not [IO.Path]::IsPathRooted($Path)) { $Path = Join-Path $script:inputDirectory $Path }
    $resolved = [IO.Path]::GetFullPath($Path)
    if (-not [IO.File]::Exists($resolved)) { Stop-Safe 'article_file_not_found' }
    return $resolved
}

function Assert-Image {
    param([string]$Path, [long]$MaximumBytes, [bool]$StrictlyLess)
    $info = Get-Item -LiteralPath $Path
    if ($info.Extension.ToLowerInvariant() -notin @('.png', '.jpg', '.jpeg')) { Stop-Safe 'image_must_be_png_or_jpeg' }
    if ($info.Length -eq 0 -or $info.Length -gt $MaximumBytes -or ($StrictlyLess -and $info.Length -eq $MaximumBytes)) {
        Stop-Safe 'image_size_exceeds_limit'
    }
    $header = [byte[]]::new(8)
    $stream = [IO.File]::OpenRead($Path)
    try { $count = $stream.Read($header, 0, 8) } finally { $stream.Dispose() }
    $png = $count -ge 8 -and [Convert]::ToHexString($header) -eq '89504E470D0A1A0A'
    $jpeg = $count -ge 3 -and $header[0] -eq 255 -and $header[1] -eq 216 -and $header[2] -eq 255
    if (-not ($png -or $jpeg)) { Stop-Safe 'invalid_image_signature' }
}

function Invoke-WeChat {
    param(
        [ValidateSet('stable_token','media/uploadimg','material/add_material','draft/add','draft/update','draft/get')][string]$Endpoint,
        $Body,
        [string]$FilePath
    )
    $script:stage = $Endpoint
    $script:failureReason = 'network_or_http_error'
    $uri = 'https://api.weixin.qq.com/cgi-bin/' + $Endpoint
    if ($Endpoint -ne 'stable_token') {
        $uri += '?access_token=' + [uri]::EscapeDataString($script:accessToken)
        if ($Endpoint -eq 'material/add_material') { $uri += '&type=image' }
    }
    $request = @{
        Uri = $uri; Method = 'Post'; TimeoutSec = 60; MaximumRedirection = 0
        MaximumRetryCount = 0; ErrorAction = 'Stop'; Verbose = $false; Debug = $false
    }
    try {
        if ($FilePath) {
            # WeChat requires a conventional quoted media field and an explicit image MIME type.
            # Build the multipart bytes directly instead of relying on PowerShell's -Form serializer.
            $fileBytes = [IO.File]::ReadAllBytes($FilePath)
            $isPng = $fileBytes.Length -ge 8 -and $fileBytes[0] -eq 137 -and $fileBytes[1] -eq 80 -and $fileBytes[2] -eq 78 -and $fileBytes[3] -eq 71
            $imageType = if ($isPng) { 'image/png' } else { 'image/jpeg' }
            $fileName = if ($isPng) { 'cover.png' } else { 'cover.jpg' }
            $boundary = 'WeChatDraft' + [guid]::NewGuid().ToString('N')
            $partHeader = '--' + $boundary + "`r`n" + 'Content-Disposition: form-data; name="media"; filename="' + $fileName + '"' + "`r`n" + 'Content-Type: ' + $imageType + "`r`n`r`n"
            $headerBytes = [Text.Encoding]::ASCII.GetBytes($partHeader)
            $footerBytes = [Text.Encoding]::ASCII.GetBytes("`r`n--" + $boundary + "--`r`n")
            $multipartStream = [IO.MemoryStream]::new()
            try {
                $multipartStream.Write($headerBytes, 0, $headerBytes.Length)
                $multipartStream.Write($fileBytes, 0, $fileBytes.Length)
                $multipartStream.Write($footerBytes, 0, $footerBytes.Length)
                $multipartBody = $multipartStream.ToArray()
            } finally { $multipartStream.Dispose() }
            $response = Invoke-RestMethod @request -ContentType ('multipart/form-data; boundary=' + $boundary) -Body $multipartBody
        } else {
            $json = $Body | ConvertTo-Json -Depth 15 -Compress
            $response = Invoke-RestMethod @request -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json))
        }
    } catch {
        # Never propagate a web exception: its URI can contain the access token.
        Stop-Safe 'network_or_http_error'
    } finally {
        $uri = $null; $request = $null; $json = $null; $fileBytes = $null; $multipartBody = $null
    }
    if ($null -ne $response.errcode -and [int]$response.errcode -ne 0) {
        $script:apiErrorCode = [int]$response.errcode
        Stop-Safe 'wechat_api_error'
    }
    return $response
}

function Get-ImageKey {
    param([string]$Url)
    $parsed = $null
    if (-not [uri]::TryCreate([Net.WebUtility]::HtmlDecode($Url), [UriKind]::Absolute, [ref]$parsed)) { return '' }
    if ($parsed.Scheme -notin @('http', 'https') -or $parsed.UserInfo) { return '' }
    if ($parsed.Host -ne 'qpic.cn' -and -not $parsed.Host.EndsWith('.qpic.cn', [StringComparison]::OrdinalIgnoreCase)) { return '' }
    # WeChat converts original image /0 to display image /640. Preserve host,
    # image family and the complete resource hash; only these two size suffixes are equivalent.
    $imagePath = $parsed.AbsolutePath
    $sizedImage = [regex]::Match($imagePath, '^/((?:sz_)?mmbiz(?:_(?:jpg|png|gif))?)/([^/]+)/(?:0|640)$')
    if ($sizedImage.Success) { $imagePath = '/' + $sizedImage.Groups[1].Value + '/' + $sizedImage.Groups[2].Value + '/{0-or-640}' }
    return $parsed.Host.ToLowerInvariant() + $imagePath
}

function Get-HtmlImageKeys {
    param([string]$Html)
    foreach ($tag in [regex]::Matches($Html, '(?is)<img\b[^>]*>')) {
        # Draft readback uses data-src for lazy loading, sometimes alongside a placeholder src.
        $src = [regex]::Match($tag.Value, '(?is)\sdata-src\s*=\s*["'']([^"'']+)["'']')
        if (-not $src.Success) { $src = [regex]::Match($tag.Value, '(?is)\ssrc\s*=\s*["'']([^"'']+)["'']') }
        if (-not $src.Success) { return '__INVALID_IMAGE__' }
        $key = Get-ImageKey $src.Groups[1].Value
        if (-not $key) { return '__INVALID_IMAGE__' }
        $key
    }
}

function Get-VisibleText {
    param([string]$Html)
    $plain = [regex]::Replace($Html, '(?is)<!--.*?-->|<(script|style)\b[^>]*>.*?</\1>', '')
    $plain = [Net.WebUtility]::HtmlDecode([regex]::Replace($plain, '(?s)<[^>]*>', ''))
    return [regex]::Replace($plain, '\s+', '')
}

try {
    $ArticleJsonPath = [IO.Path]::GetFullPath($ArticleJsonPath)
    $script:inputDirectory = [IO.Path]::GetDirectoryName($ArticleJsonPath)
    if ([bool]$UpdateMediaId -ne [bool]$ExpectedDraftSnapshot) { Stop-Safe 'update_requires_previous_snapshot' }
    if ($UpdateMediaId) {
        $previousPath = Resolve-ArticleFile $ExpectedDraftSnapshot
        $previousDraft = Get-Content -LiteralPath $previousPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ([string]$previousDraft.media_id -cne $UpdateMediaId) { Stop-Safe 'previous_snapshot_target_mismatch' }
    }
    $article = Get-Content -LiteralPath $ArticleJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json -AsHashtable
    foreach ($field in @('title','content_html_path','cover_path')) {
        if (-not $article.Contains($field) -or [string]::IsNullOrWhiteSpace([string]$article[$field])) { Stop-Safe 'missing_required_article_field' }
    }
    if ([Globalization.StringInfo]::new([string]$article.title).LengthInTextElements -gt 32) { Stop-Safe 'title_exceeds_32_characters' }
    if ([Globalization.StringInfo]::new([string]$article.author).LengthInTextElements -gt 16) { Stop-Safe 'author_exceeds_16_characters' }
    if ([Globalization.StringInfo]::new([string]$article.digest).LengthInTextElements -gt 120) { Stop-Safe 'digest_exceeds_120_characters' }
    if ([Text.Encoding]::UTF8.GetByteCount([string]$article.content_source_url) -ge 1024) { Stop-Safe 'source_url_exceeds_limit' }
    if ($article.content_source_url) {
        $sourceUri = $null
        if (-not [uri]::TryCreate([string]$article.content_source_url, [UriKind]::Absolute, [ref]$sourceUri) -or $sourceUri.Scheme -notin @('http','https') -or $sourceUri.UserInfo) { Stop-Safe 'invalid_source_url' }
    }
    $htmlPath = Resolve-ArticleFile $article.content_html_path
    $coverPath = Resolve-ArticleFile $article.cover_path
    Assert-Image $coverPath (10MB) $false
    $html = [IO.File]::ReadAllText($htmlPath, [Text.Encoding]::UTF8)
    if ([string]::IsNullOrWhiteSpace($html) -or $html.Length -ge 20000 -or [Text.Encoding]::UTF8.GetByteCount($html) -ge 1MB) { Stop-Safe 'html_empty_or_exceeds_limit' }
    $images = @()
    foreach ($item in @($article.body_images)) {
        if ($null -eq $item) { continue }
        $placeholder = [string]$item.placeholder
        if ([string]::IsNullOrWhiteSpace($placeholder) -or -not $html.Contains($placeholder)) { Stop-Safe 'image_placeholder_not_found' }
        if ($images.placeholder -ccontains $placeholder) { Stop-Safe 'duplicate_image_placeholder' }
        $imagePath = Resolve-ArticleFile $item.local_path
        Assert-Image $imagePath (1MB) $true
        $images += [ordered]@{ local_path = $imagePath; placeholder = $placeholder; sha256 = (Get-FileHash -LiteralPath $imagePath -Algorithm SHA256).Hash }
    }
    $manifest = [ordered]@{
        title = [string]$article.title; author = [string]$article.author; digest = [string]$article.digest
        content_source_url = [string]$article.content_source_url
        html_sha256 = (Get-FileHash -LiteralPath $htmlPath -Algorithm SHA256).Hash
        cover_sha256 = (Get-FileHash -LiteralPath $coverPath -Algorithm SHA256).Hash
        body_images = $images
    }
    if ($UpdateMediaId) {
        $manifest.update_media_id = $UpdateMediaId
        $manifest.previous_snapshot_sha256 = (Get-FileHash -LiteralPath $previousPath -Algorithm SHA256).Hash
    }
    $manifestBytes = [Text.Encoding]::UTF8.GetBytes(($manifest | ConvertTo-Json -Depth 10 -Compress))
    $inputHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($manifestBytes))
    $OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
    [void][IO.Directory]::CreateDirectory($OutputDirectory)
    $script:failureReason = 'output_directory_in_use'
    $lockStream = [IO.File]::Open((Join-Path $OutputDirectory '.draft.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $script:failureReason = 'local_journal_error'
    $script:journalPath = Join-Path $OutputDirectory 'upload-journal.json'
    $receiptPath = Join-Path $OutputDirectory 'draft-receipt.json'
    if ([IO.File]::Exists($script:journalPath)) {
        $script:journal = Get-Content -LiteralPath $script:journalPath -Raw -Encoding UTF8 | ConvertFrom-Json -AsHashtable
        if ($script:journal.schema_version -ne 1 -or $script:journal.input_sha256 -ne $inputHash) { Stop-Safe 'output_directory_belongs_to_different_input' }
    } else {
        if ([IO.File]::Exists($receiptPath)) { Stop-Safe 'receipt_without_journal_requires_review' }
        $script:journal = [ordered]@{
            schema_version = 1; input_sha256 = $inputHash; created_at = [DateTimeOffset]::Now.ToString('o')
            updated_at = ''; title = $article.title; body_images = @(); cover = @{ status = 'pending'; media_id = '' }
            draft = @{ status = 'pending'; media_id = '' }; verification = $null; last_error = $null
        }
        Save-Journal
    }
    if ([IO.File]::Exists($receiptPath)) {
        $receipt = Get-Content -LiteralPath $receiptPath -Raw -Encoding UTF8 | ConvertFrom-Json -AsHashtable
        if ($receipt.media_id) {
            if ($script:journal.draft.media_id -and $script:journal.draft.media_id -ne $receipt.media_id) { Stop-Safe 'draft_receipt_conflict' }
            $script:journal.draft.media_id = [string]$receipt.media_id
        }
    }
    $existingDraft = -not [string]::IsNullOrWhiteSpace([string]$script:journal.draft.media_id)
    if (-not $existingDraft -and $script:journal.draft.status -in @('submitting','unknown')) { Stop-Safe 'draft_creation_uncertain_do_not_retry' }
    if (-not $existingDraft -and $script:journal.cover.status -in @('uploading','unknown')) { Stop-Safe 'cover_upload_uncertain_requires_review' }
    if (-not $existingDraft -and @($script:journal.body_images | Where-Object { $_.status -in @('uploading','unknown') }).Count) { Stop-Safe 'body_image_upload_uncertain_requires_review' }

    $script:stage = 'credentials'
    $script:failureReason = 'local_configuration_error'
    $accountPath = Join-Path $env:LOCALAPPDATA 'AIPioneer\wechat\account.json'
    $account = Get-Content -LiteralPath $accountPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $secureSecret = ConvertTo-SecureString -String $account.app_secret_dpapi
    $secret = [Net.NetworkCredential]::new('', $secureSecret).Password
    $authBody = @{ grant_type = 'client_credential'; appid = [string]$account.app_id; secret = $secret; force_refresh = $false }
    $auth = Invoke-WeChat -Endpoint 'stable_token' -Body $authBody
    if ([string]::IsNullOrWhiteSpace([string]$auth.access_token)) { Stop-Safe 'unexpected_auth_response' }
    $script:accessToken = [string]$auth.access_token
    $secret = $null; $authBody = $null; $auth = $null; $account = $null
    $secureSecret.Dispose(); $secureSecret = $null

    if (-not $existingDraft) {
        for ($index = 0; $index -lt $images.Count; $index++) {
            if ($index -ge $script:journal.body_images.Count) {
                $script:journal.body_images += @{ index = $index; placeholder = $images[$index].placeholder; sha256 = $images[$index].sha256; status = 'pending'; url = '' }
            }
            $entry = $script:journal.body_images[$index]
            if ($entry.status -ne 'uploaded') {
                $entry.status = 'uploading'; Save-Journal
                try {
                    $uploaded = Invoke-WeChat -Endpoint 'media/uploadimg' -FilePath $images[$index].local_path
                    if (-not (Get-ImageKey ([string]$uploaded.url))) { Stop-Safe 'unexpected_image_upload_response' }
                    $entry.url = [string]$uploaded.url; $entry.status = 'uploaded'; Save-Journal
                } catch {
                    $entry.status = if ($script:failureReason -eq 'wechat_api_error') { 'rejected' } else { 'unknown' }
                    Save-Journal; throw
                }
            }
        }
        if (-not $script:journal.cover.media_id) {
            $script:journal.cover.status = 'uploading'; Save-Journal
            try {
                $cover = Invoke-WeChat -Endpoint 'material/add_material' -FilePath $coverPath
                if ([string]::IsNullOrWhiteSpace([string]$cover.media_id)) { Stop-Safe 'unexpected_cover_response' }
                $script:journal.cover.media_id = [string]$cover.media_id
                $script:journal.cover.status = 'uploaded'; Save-Journal
            } catch {
                $script:journal.cover.status = if ($script:failureReason -eq 'wechat_api_error') { 'rejected' } else { 'unknown' }
                Save-Journal; throw
            }
        }
    }
    foreach ($entry in $script:journal.body_images) { $html = $html.Replace([string]$entry.placeholder, [Net.WebUtility]::HtmlEncode([string]$entry.url)) }
    if ($html.Length -ge 20000 -or [Text.Encoding]::UTF8.GetByteCount($html) -ge 1MB) { Stop-Safe 'uploaded_html_exceeds_limit' }
    $expectedKeys = @(Get-HtmlImageKeys $html)
    $allowedKeys = @($script:journal.body_images | ForEach-Object { Get-ImageKey ([string]$_.url) })
    if (@($expectedKeys | Where-Object { $_ -eq '__INVALID_IMAGE__' -or $_ -notin $allowedKeys }).Count) { Stop-Safe 'html_contains_unuploaded_image' }
    [IO.File]::WriteAllText((Join-Path $OutputDirectory 'uploaded-content.html'), $html, [Text.UTF8Encoding]::new($false))
    $submitted = [ordered]@{
        article_type = 'news'; title = [string]$article.title; author = [string]$article.author
        digest = [string]$article.digest; content = $html; content_source_url = [string]$article.content_source_url
        thumb_media_id = [string]$script:journal.cover.media_id; need_open_comment = 0; only_fans_can_comment = 0
    }
    if (-not $existingDraft) {
        if ($UpdateMediaId) {
            $before = Invoke-WeChat -Endpoint 'draft/get' -Body @{ media_id = $UpdateMediaId }
            if (@($before.news_item).Count -ne 1) { Stop-Safe 'update_requires_single_article_draft' }
            $beforeArticle = $before.news_item[0]
            foreach ($field in @('title','author','digest','content','thumb_media_id','content_source_url')) {
                if ([string]$beforeArticle.$field -cne [string]$previousDraft.$field) { Stop-Safe 'draft_changed_since_previous_snapshot' }
            }
            Write-AtomicJson -Path (Join-Path $OutputDirectory 'previous-draft.json') -Value $previousDraft
        }
        # Persist the intent before the only draft/add request. A crash or timeout must never cause an automatic retry.
        $script:journal.draft.status = 'submitting'; Save-Journal
        try {
            if ($UpdateMediaId) {
                $updated = Invoke-WeChat -Endpoint 'draft/update' -Body @{ media_id = $UpdateMediaId; index = 0; articles = $submitted }
                $added = @{ media_id = $UpdateMediaId }
            } else {
                $added = Invoke-WeChat -Endpoint 'draft/add' -Body @{ articles = @($submitted) }
            }
            if ([string]::IsNullOrWhiteSpace([string]$added.media_id)) { Stop-Safe 'unexpected_draft_add_response' }
            $script:journal.draft.media_id = [string]$added.media_id
            $script:journal.draft.status = 'created'
            $receipt = [ordered]@{ media_id = [string]$added.media_id; created_at = [DateTimeOffset]::Now.ToString('o'); verified = $false; draft_url = ''; verification = $null }
            Write-AtomicJson -Path $receiptPath -Value $receipt
            Save-Journal
        } catch {
            if (-not $script:journal.draft.media_id) {
                $script:journal.draft.status = if ($script:failureReason -eq 'wechat_api_error') { 'rejected' } else { 'unknown' }
                Save-Journal
            }
            throw
        }
    }

    $retrieved = Invoke-WeChat -Endpoint 'draft/get' -Body @{ media_id = [string]$script:journal.draft.media_id }
    if (@($retrieved.news_item).Count -ne 1 -or -not $retrieved.news_item[0].content) { Stop-Safe 'unexpected_draft_get_response' }
    $saved = $retrieved.news_item[0]
    $savedContent = [string]$saved.content
    $actualKeys = @(Get-HtmlImageKeys $savedContent)
    $verification = [ordered]@{
        checked_at = [DateTimeOffset]::Now.ToString('o'); article_count = @($retrieved.news_item).Count
        title_matches = ([string]$saved.title -ceq $submitted.title)
        author_matches = ([string]$saved.author -ceq $submitted.author)
        digest_matches = (-not $submitted.digest -or [string]$saved.digest -ceq $submitted.digest)
        cover_matches = ([string]$saved.thumb_media_id -ceq $submitted.thumb_media_id)
        visible_text_matches = ((Get-VisibleText $savedContent) -ceq (Get-VisibleText $html))
        image_count = $actualKeys.Count
        images_match = (($actualKeys -join "`n") -ceq ($expectedKeys -join "`n"))
        html_exact_match = ($savedContent -ceq $html)
    }
    $verified = $verification.title_matches -and $verification.author_matches -and $verification.digest_matches -and $verification.cover_matches -and $verification.visible_text_matches -and $verification.images_match
    # Save only known content fields; never serialize an entire HTTP response or exception.
    $retrievedSafe = [ordered]@{
        media_id = [string]$script:journal.draft.media_id; title = [string]$saved.title
        author = [string]$saved.author; digest = [string]$saved.digest; content = $savedContent
        content_source_url = [string]$saved.content_source_url; thumb_media_id = [string]$saved.thumb_media_id
        article_type = [string]$saved.article_type; url = [string]$saved.url
    }
    Write-AtomicJson -Path (Join-Path $OutputDirectory 'retrieved-draft.json') -Value $retrievedSafe
    [IO.File]::WriteAllText((Join-Path $OutputDirectory 'retrieved-content.html'), $savedContent, [Text.UTF8Encoding]::new($false))
    if (-not $receipt) { $receipt = [ordered]@{ media_id = [string]$script:journal.draft.media_id; created_at = $script:journal.created_at } }
    $receipt.verified = [bool]$verified; $receipt.draft_url = [string]$saved.url; $receipt.verification = $verification
    Write-AtomicJson -Path $receiptPath -Value $receipt
    $script:journal.draft.status = if ($verified) { 'verified' } else { 'verification_mismatch' }
    $script:journal.verification = $verification; $script:journal.last_error = $null; Save-Journal
    if (-not $verified) { Stop-Safe 'draft_saved_but_verification_mismatch' }
    $exitCode = 0
    [ordered]@{ ok = $true; action = $(if ($existingDraft) { 'verified_existing_draft' } elseif ($UpdateMediaId) { 'updated_and_verified_draft' } else { 'created_and_verified_draft' }); media_id = $script:journal.draft.media_id; verified = $true; receipt_path = $receiptPath } | ConvertTo-Json -Depth 6
} catch {
    $safeFailure = [ordered]@{
        ok = $false; stage = $script:stage; reason = $script:failureReason; errcode = $script:apiErrorCode
        media_id = $(if ($script:journal) { [string]$script:journal.draft.media_id } else { '' })
        draft_status = $(if ($script:journal) { [string]$script:journal.draft.status } else { 'not_started' })
    }
    if ($script:journal -and $lockStream -and $script:failureReason -ne 'output_directory_belongs_to_different_input') {
        try { $script:journal.last_error = $safeFailure; Save-Journal } catch { }
    }
    $safeFailure | ConvertTo-Json -Depth 6
} finally {
    $secret = $null; $authBody = $null; $auth = $null; $account = $null; $script:accessToken = $null
    if ($secureSecret) { $secureSecret.Dispose() }
    if ($lockStream) { $lockStream.Dispose() }
}
exit $exitCode
