// Copies the alarm sounds (assets/sounds/*.caf) into the iPhone app bundle.
//
// AlarmKit's AlertSound.named("american-robin.caf") looks for the file in the app's main
// bundle, but Expo puts normal assets in a separate asset folder. So this plugin copies each
// .caf into the Xcode project and adds it to the app target's resources during prebuild.
const fs = require('fs');
const path = require('path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const SOUNDS_DIR = 'assets/sounds';

function soundFiles(projectRoot) {
  const dir = path.join(projectRoot, SOUNDS_DIR);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.caf')).sort() : [];
}

module.exports = function withAlarmSounds(config) {
  config = withDangerousMod(config, [
    'ios',
    async (c) => {
      const { projectRoot, platformProjectRoot } = c.modRequest;
      const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
      const dest = path.join(platformProjectRoot, projectName);
      fs.mkdirSync(dest, { recursive: true });
      for (const f of soundFiles(projectRoot)) {
        fs.copyFileSync(path.join(projectRoot, SOUNDS_DIR, f), path.join(dest, f));
      }
      return c;
    },
  ]);
  config = withXcodeProject(config, (c) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(c.modRequest.projectRoot);
    for (const f of soundFiles(c.modRequest.projectRoot)) {
      const filepath = `${projectName}/${f}`;
      if (!c.modResults.hasFile(filepath)) {
        IOSConfig.XcodeUtils.addResourceFileToGroup({
          filepath,
          groupName: projectName,
          isBuildFile: true,
          project: c.modResults,
        });
      }
    }
    return c;
  });
  return config;
};
