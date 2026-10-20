// Reader-facing checks: reject production artifacts; never silently delete prose.
export function findReaderIssues(markdown) {
  const issues = [];
  let references = false;
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) references = /^(?:参考资料|资料来源|来源与参考|References|Sources)\s*[:：]?$/i.test(heading[1]);
    if (/|||\bturn\d+(?:search|view|fetch)\d+\b|【\d+†[^】]*】/.test(line)) {
      issues.push({ line: index + 1, reason: '内部检索或引用标记进入文章' });
    }
    if (/<!--|\bTODO\b|\bFIXME\b|(?:^|\[|【)(?:编辑备注|待核实|待补充|写作提示|待插入)(?:[:：\]】]|$)/i.test(line)) {
      issues.push({ line: index + 1, reason: '编辑过程信息或未完成占位内容' });
    }
    if (references || /^!\[/.test(line)) continue;
    const links = [...line.matchAll(/(?<!!)\[([^\]]+)\]\(https?:\/\/[^)]+\)/g)];
    for (const match of links) {
      const prefix = line.slice(0, match.index).trimEnd();
      const sourceLabel = /^(?:原视频|原文|研究论文|官方(?:任务说明|更新|方法|说明)|.*\s官方(?:更新|方法|说明)|.*\s方法说明|.*\s投资名单)(?:[，,：:\s]|$)/.test(match[1]);
      const detached = !prefix || /[。！？.!?）)]$/.test(prefix);
      if (sourceLabel || detached) issues.push({ line: index + 1, reason: '正文有孤立来源链接；移至文末参考资料', label: match[1] });
    }
    if (/[。！？]\s*(?:Vals(?: Smith)?\s*(?:官方更新|方法说明|官方方法)|官方任务说明|研究论文(?:，[^。]+)?|a16z\s*投资名单|原视频[，,][\d:：起—–\-\s]+)\s*[。.]?$/.test(line)) {
      issues.push({ line: index + 1, reason: '正文句尾残留已失去链接的来源标签' });
    }
  }
  return issues;
}

export function assertReaderReady(markdown) {
  const issues = findReaderIssues(markdown);
  if (issues.length) throw new Error(`Reader-facing quality gate failed: ${JSON.stringify(issues)}`);
}
