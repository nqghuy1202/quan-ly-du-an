// The sdvico theme. `astryx experimental theme editor` wrote this file once and never changes it again.
// The checked settings live in sdvico.settings.json and the generated sdvico.settings.ts;
// change them with `astryx experimental theme editor set sdvico ...`. Add your own changes below: they win over the settings.
import {defineTheme} from '@astryxdesign/core/theme';
import {sdvicoSettings} from './sdvico.settings';

export const sdvicoTheme = defineTheme({
  extends: sdvicoSettings,
  name: 'sdvico',
});
