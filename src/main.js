import { S } from './model.js';
import { DAO } from './dao.js';
import { bindAll, resetSessionTimer, startClock, startDataLoop } from './events.js';
import { initThreeJS } from './three-twin.js';
import { scheduleRender, dispatch } from './reducer.js';
import { ACTION_TYPES as A } from '../constants/actionTypes.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize DAO from config (ISA-101 §5.4)
  DAO.init();

  bindAll();
  startClock();
  startDataLoop();
  initThreeJS();
  scheduleRender();

  // Session activity tracking (NUREG-0700 §6.5)
  ['mousemove','keydown','click','touchstart'].forEach(evt =>
    document.addEventListener(evt, () => {
      if (S && S.role) { 
        dispatch(A.TOUCH_ACTIVITY); 
        resetSessionTimer(); 
      }
    }, { passive: true })
  );
});
