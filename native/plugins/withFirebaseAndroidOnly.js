// Apply ONLY the Android pieces of @react-native-firebase/app.
//
// Why: we added @react-native-firebase/app to initialize FirebaseApp for the
// Twilio *Android* Voice SDK (Twilio Android registration needs FCM). iOS uses
// PushKit/APNs and does NOT need Firebase. The upstream plugin's iOS step
// (`withIosGoogleServicesFile`) THROWS unless `expo.ios.googleServicesFile` is
// set — so the default `"@react-native-firebase/app"` plugin entry breaks
// `eas build --platform ios` at prebuild. Scoping to Android-only keeps the
// Android FCM wiring intact while leaving the iOS build clean (the iOS Firebase
// pod still autolinks and compiles, but `[FIRApp configure]` is never injected,
// so Firebase stays dormant on iOS — nothing there references it).
const path = require('path');
const { withPlugins } = require('@expo/config-plugins');

// The package's `exports` map doesn't expose `./plugin/build/android` as a
// subpath specifier, so resolve the package root and require it by ABSOLUTE
// path (absolute requires bypass the exports field).
const rnfbDir = path.dirname(require.resolve('@react-native-firebase/app/package.json'));
const {
  withBuildscriptDependency,
  withApplyGoogleServicesPlugin,
  withCopyAndroidGoogleServices,
} = require(path.join(rnfbDir, 'plugin', 'build', 'android'));

module.exports = function withFirebaseAndroidOnly(config) {
  return withPlugins(config, [
    withBuildscriptDependency,
    withApplyGoogleServicesPlugin,
    withCopyAndroidGoogleServices,
  ]);
};
