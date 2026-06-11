import { getEnv, getMethodByEnv } from './xenv';

const setPassengerTitle = (title: string) => {
  const env = getEnv();
  if (env === 'passenger' && (window as any).Fusion) {
    (window as any).Fusion.setTitle({ title });
  }
};

const setCommonTitle = (title: string) => {
  window.document.title = title;
};

export const setPageTitle = getMethodByEnv({
  wxmp: setCommonTitle,
  alimp: setCommonTitle,
  qjwxmp: setCommonTitle,
  crwxmp: setCommonTitle,
  passenger: setPassengerTitle,
  h5: setCommonTitle,
});
