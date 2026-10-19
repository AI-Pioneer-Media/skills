#requires -Version 7.0
[CmdletBinding()]
param([Parameter(Mandatory)][string]$MediaId,[Parameter(Mandatory)][string]$OutputPath)
$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; $VerbosePreference='SilentlyContinue'; $DebugPreference='SilentlyContinue'
$code=0; $secure=$null
try {
    if (Test-Path -LiteralPath $OutputPath) { throw 'Use a fresh snapshot path' }
    $account=Get-Content -LiteralPath (Join-Path $env:LOCALAPPDATA 'AIPioneer\wechat\account.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $secure=ConvertTo-SecureString $account.app_secret_dpapi
    $body=@{grant_type='client_credential';appid=$account.app_id;secret=[Net.NetworkCredential]::new('',$secure).Password;force_refresh=$false} | ConvertTo-Json -Compress
    $auth=Invoke-RestMethod -Uri 'https://api.weixin.qq.com/cgi-bin/stable_token' -Method Post -Body ([Text.Encoding]::UTF8.GetBytes($body)) -ContentType 'application/json' -MaximumRedirection 0 -MaximumRetryCount 0 -TimeoutSec 60
    if (-not $auth.access_token) { throw 'Authentication failed' }
    $uri='https://api.weixin.qq.com/cgi-bin/draft/get?access_token='+[uri]::EscapeDataString($auth.access_token)
    $result=Invoke-RestMethod -Uri $uri -Method Post -Body (@{media_id=$MediaId}|ConvertTo-Json -Compress) -ContentType 'application/json' -MaximumRedirection 0 -MaximumRetryCount 0 -TimeoutSec 60
    if ($result.errcode -or @($result.news_item).Count -ne 1) { throw 'Expected single article draft' }
    $item=$result.news_item[0]
    $snapshot=[ordered]@{media_id=$MediaId}
    foreach($field in @('title','author','digest','content','thumb_media_id','content_source_url','article_type')) {$snapshot[$field]=[string]$item.$field}
    $destination=[IO.Path]::GetFullPath($OutputPath)
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))
    [IO.File]::WriteAllText($destination,($snapshot|ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))
    @{ok=$true;snapshot=$destination}|ConvertTo-Json -Compress
} catch {
    # Do not print HTTP exceptions: request URLs can contain the token.
    @{ok=$false;reason='snapshot_read_failed';hint='Check fresh output path, local account configuration, whitelist and draft access'}|ConvertTo-Json -Compress
    $code=2
} finally {
    $body=$null;$auth=$null;$uri=$null;$account=$null;if($secure){$secure.Dispose()}
}
exit $code
