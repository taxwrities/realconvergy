import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Theme} from '@astryxdesign/core/theme';
import {gothicTheme} from '@astryxdesign/theme-gothic/built';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-gothic/theme.css';
import './cvg.css';
import './player-card.css';
import App from './App.jsx';
import {AppStateProvider} from './state/store.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Theme theme={gothicTheme} mode="dark">
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </Theme>
  </StrictMode>,
);
