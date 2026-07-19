import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// Font loading via delayRender() can exceed the default 28s timeout on
// CPU-constrained machines when several render tabs start at once.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// Allow pointing Remotion at a pre-installed Chromium (e.g. in CI or sandboxes
// where downloading the headless shell is not possible).
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
