import { getMethodByEnv, passengerInit } from './xenv';
import { getAllQuery } from './url';
// @ts-ignore
import coordtransform from 'coordtransform';
import { http } from './kop';
import { diffParamsForTrack } from './error-track';

interface GeolocationSuccess {
  success: true;
  latitude: number;
  longitude: number;
  cityId: number;
}
interface GeolocationFail {
  success: false;
}
export type IGeolocation = GeolocationSuccess | GeolocationFail;

function getCurrentPositionH5(): Promise<IGeolocation> {
  return new Promise((resolve) => {
    window.navigator.geolocation.getCurrentPosition(
      (v) => {
        const gcj02 = coordtransform.wgs84togcj02(v.coords.longitude, v.coords.latitude);
        resolve({ latitude: gcj02[1], longitude: gcj02[0], cityId: 0, success: true });
      },
      () => resolve({ success: false }),
      { enableHighAccuracy: true, timeout: 5000 },
    );
  });
}

async function getCurrentPositionWx(): Promise<IGeolocation> {
  const query = getAllQuery(window.location.href);
  if (query.lat && query.lng) {
    return { latitude: Number(query.lat), longitude: Number(query.lng), cityId: 0, success: true };
  }
  return new Promise((resolve) => {
    (window as any).wx.error((res: any) => {
      console.log('wx.error', res);
      resolve({ success: false });
    });
    (window as any).wx.ready(() => {
      (window as any).wx.getLocation({
        type: 'gcj02',
        success: (res: { latitude: number; longitude: number }) => {
          resolve({ latitude: res.latitude, longitude: res.longitude, cityId: 0, success: true });
        },
        fail: () => resolve({ success: false }),
      });
    });
  });
}

async function getCurrentPositionMy(): Promise<IGeolocation> {
  const query = getAllQuery(window.location.href);
  if (query.lat && query.lng) {
    return { latitude: Number(query.lat), longitude: Number(query.lng), cityId: 0, success: true };
  }
  return new Promise((resolve) => {
    (window as any).my.getLocation({
      type: 0,
      success: (res: { latitude: number; longitude: number }) => {
        resolve({ latitude: res.latitude, longitude: res.longitude, cityId: 0, success: true });
      },
      fail: () => resolve({ success: false }),
    });
  });
}

async function getCurrentPositionPassenger(): Promise<IGeolocation> {
  await passengerInit();
  return new Promise((resolve) => {
    (window as any).Fusion.getLocationInfo({}, (data: any) => {
      if (data.authorized === 0 || !data.lng || !data.lat) {
        resolve({ success: false });
      }
      resolve({
        latitude: data.lat,
        longitude: data.lng,
        cityId: Number(data.city_id),
        success: true,
      });
    });
  });
}

export const getCurrentPosition = getMethodByEnv({
  wxmp: getCurrentPositionWx,
  alimp: getCurrentPositionMy,
  qjwxmp: getCurrentPositionWx,
  crwxmp: getCurrentPositionWx,
  passenger: getCurrentPositionPassenger,
  wxh5: getCurrentPositionWx,
  h5: getCurrentPositionH5,
});

const cachedCityId: Record<string, number> = {};

export async function getCityIdH5(latitude: number, longitude: number): Promise<number> {
  diffParamsForTrack('getCityIdH5', { latitude, longitude }, ['latitude', 'longitude']);
  if (latitude && longitude) {
    const query = `lng=${longitude}&lat=${latitude}`;
    if (cachedCityId[query]) return cachedCityId[query];
    const { data } = await http.get(`https://star.xiaojukeji.com/data/getCityId?${query}`);
    if (Number(data.code) === 200 && data.data && data.data.area) {
      cachedCityId[query] = data.data.area;
      return data.data.area;
    }
  }
  return 0;
}

export async function getCityIdWx(latitude: number, longitude: number): Promise<number> {
  const query = getAllQuery(window.location.href);
  if (query.cityId) return Number(query.cityId);
  return getCityIdH5(latitude, longitude);
}

export async function getCityIdPassenger(): Promise<number> {
  await passengerInit();
  return new Promise((resolve) => {
    (window as any).Fusion.getLocationInfo({}, (data: any) => {
      if (data.authorized === 0 || !data.lng || !data.lat) {
        resolve(0);
      }
      resolve(Number(data.city_id));
    });
  });
}

export const getCityId = getMethodByEnv({
  wxmp: getCityIdWx,
  alimp: getCityIdWx,
  qjwxmp: getCityIdWx,
  crwxmp: getCityIdWx,
  passenger: getCityIdPassenger,
  h5: getCityIdH5,
});
