import test from 'node:test';
import assert from 'node:assert/strict';
import { assertReaderReady, findReaderIssues } from './reader-quality.mjs';

const bad = [
  '因此调整了指数构成。[Vals 官方更新](https://www.vals.ai/home)',
  '私有本身并不保证公平。[Vals 方法说明](https://www.vals.ai/about)',
  '点赞、评论、删除内容。[官方任务说明](https://www.vals.ai/benchmarks/vibe-code)',
  '这个判断有依据。[另一份资料](https://example.com)',
  '完成了。Vals 官方更新',
  '完成了。官方任务说明',
  '这是事实。citeturn1search0',
  '出处 turn1view2',
  '【编辑备注】这里以后换图',
  '<!-- 暂不发布 -->',
  'TODO: 核对来源',
  '### 参考资料\n[某来源](https://example.com)\n## 正文继续\n完成了。[官方任务说明](https://example.com)',
];
for (const sample of bad) test(`rejects ${sample.slice(0, 35)}`, () => assert.throws(() => assertReaderReady(sample), /quality gate failed/));

const good = [
  'Vals 在官方更新中解释了修改原因。',
  '阅读[这篇论文](https://example.com)可以了解方法。',
  '![官方流程图](D:/article/image.png)',
  '### 参考资料\n1. [Vals 官方更新](https://www.vals.ai/home)\n2. [研究论文](https://arxiv.org/abs/2603.04601v3)',
  '*来源：a16z 原访谈，23:19。*',
  '[BLUE]可信还需要另外的证据。[/BLUE]',
];
for (const sample of good) test(`preserves ${sample.slice(0, 35)}`, () => assert.deepEqual(findReaderIssues(sample), []));
