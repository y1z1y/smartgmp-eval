import React, { useEffect, useState } from 'react';
import styles from './index.module.scss';
import { padStart } from 'lodash';
import dayjs from 'dayjs';

interface Props {
  endTime: number;
}

function durationToCountdown(duration: number) {
  var day = Math.trunc(duration / 60 / 60 / 24);
  var hours: number | string = Math.trunc((duration / 60 / 60) % 24);
  var minutes: number | string = Math.trunc((duration / 60) % 60);
  var seconds: number | string = Math.trunc(duration % 60);
  return [day, hours, minutes, seconds];
}

export default function Countdown({ endTime }: Props) {
  const [timeArray, setTimeArray] = useState<number[]>([]);
  useEffect(() => {
    setTimeArray(
      durationToCountdown(
        (dayjs(endTime).endOf('day').valueOf() - Date.now()) / 1000,
      ),
    );
    const timer = setInterval(() => {
      setTimeArray(
        durationToCountdown(
          (dayjs(endTime).endOf('day').valueOf() - Date.now()) / 1000,
        ),
      );
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [endTime]);
  if (timeArray.length === 0) {
    return null;
  }

  return (
    <div className={styles.countdown}>
      <div>
        <span className={styles.digit}>
          {padStart(timeArray[0].toString(), 2)}
        </span>
        天
      </div>
      <div>
        <span className={styles.digit}>
          {padStart(timeArray[1].toString(), 2)}
        </span>
        时
      </div>
      <div>
        <span className={styles.digit}>
          {padStart(timeArray[2].toString(), 2)}
        </span>
        分
      </div>
      <div>
        <span className={styles.digit}>
          {padStart(timeArray[3].toString(), 2)}
        </span>
        秒
      </div>
    </div>
  );
}
