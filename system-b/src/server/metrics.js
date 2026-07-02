const pidusage = require('pidusage');

const ALLOCATED_CORES = 0.5;
const SCALE_FACTOR    = 1 / ALLOCATED_CORES;

let _lastCpu   = 0;
let _lastNonZeroCpu  = 0;
let _lastSample = Date.now();

setInterval(async () => {
  try {
    const stats = await pidusage(process.pid);
    const scaled = parseFloat(
      Math.min(stats.cpu * SCALE_FACTOR, 100).toFixed(2)
    );

     _lastSampleTime = Date.now();

    // only update if value is non-zero OR enough time has passed
    // prevents stale zero overwriting a real value
    if (scaled > 0 || Date.now() - _lastSample > 3000) {
      _lastCpu    = scaled;
      _lastSample = Date.now();
    }
     else {
      // if we got 0, only trust it if event loop has been consistently idle
      // (last non-zero was more than 3 seconds ago)
      const timeSinceNonZero = Date.now() - _lastSampleTime;
      _lastCpu = timeSinceNonZero > 3000 ? 0 : _lastNonZeroCpu;
    }
  } catch {}
}, 500); // sample every 500ms instead of 1000ms for fresher readings

pidusage(process.pid)
  .then(s => {
    _lastCpu = parseFloat(
      Math.min(s.cpu * SCALE_FACTOR, 100).toFixed(2)
    );
     _lastNonZeroCpu = _lastCpu;
  })
  .catch(() => {});

function getCpuPercent() {
  return _lastCpu;
}

module.exports = getCpuPercent;