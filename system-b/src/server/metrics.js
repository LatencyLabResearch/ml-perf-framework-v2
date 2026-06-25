const os = require('os');

let previousCpuTimes = os.cpus().map(c => ({ ...c.times }));

function getCpuPercent() {
  const currentCpus = os.cpus();

  const usages = currentCpus.map((cpu, i) => {
    const prev = previousCpuTimes[i];
    const curr = cpu.times;

    const prevTotal = Object.values(prev).reduce((a, b) => a + b, 0);
    const currTotal = Object.values(curr).reduce((a, b) => a + b, 0);

    const totalDelta = currTotal - prevTotal;
    const idleDelta  = curr.idle - prev.idle;

    return totalDelta === 0 ? 0 : ((totalDelta - idleDelta) / totalDelta) * 100;
  });

  previousCpuTimes = currentCpus.map(c => ({ ...c.times }));

  return usages.reduce((a, b) => a + b, 0) / usages.length;
}

module.exports = getCpuPercent;