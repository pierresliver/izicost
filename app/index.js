// App entry. The background price-check task must be defined before anything renders, because Android can
// wake the app headless (no screen) to run it — so it is imported here, ahead of the router.
import './src/features/watch/background';
import 'expo-router/entry';
