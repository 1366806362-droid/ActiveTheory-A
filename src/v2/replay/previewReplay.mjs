import { createReplayReport, formatReplayReport } from './replayReport.js';
import { runAllBindingReplays } from './replayRunner.js';

const report = createReplayReport(runAllBindingReplays());
console.log(formatReplayReport(report));
if (report.failed) process.exitCode = 1;
