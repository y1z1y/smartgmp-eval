import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Provider, createStore, atom, useAtomValue, useSetAtom } from 'jotai';
import styles from './index.module.scss';
import {
  BenefitResult,
  MainTaskResult,
  TaskConfig,
  queryAwardPopupWindow,
  queryTaskCenterList,
  queryTaskList,
  taskReceive,
  taskReceiveAward,
} from './api';
import dayjs from 'dayjs';
import Banner from './components/banner';
import Content from './components/content';
import Prize, { isSortToMiddlePayMisProductId } from './components/prize';
import queryTaskCenterListMock from './mock/queryTaskCenterList';
import listQueryMock from './mock/listQuery';
import awardMock from './mock/query-award';
import { useInView } from 'react-intersection-observer';
import { htwSdkModules } from '../../sdk-provider';
import type { QjCashbackProps } from './types';
import { resolveQjCashbackProps } from './defaults';

const { xenv, url, goto } = htwSdkModules;

const defaultGeolocationAtom = atom<any>({ success: false });
const defaultSeriesTaskInfoAtom = atom<any>(null);

function CashBackComponentInner(props: QjCashbackProps) {
  const {
    store,
    atomMap,
    bannerimg,
    taskcontent,
    status,
    arrowimg,
    cyclingbtnimage,
    __designMode,
    cyclingincompletelink,
    cyclingcompletedlink,
    reminddata,
    skinConfigure,
    buttonConfigure,
    previewVisible = false,
    subscribeConfig,
    priority = 0,
    mockData,
  } = props;

  const { campaignId, bizId, ddchn } = url.getAllQuery(
    typeof window !== 'undefined' ? window.location.href : '',
  );

  const geo = useAtomValue(atomMap?.geolocationAtom || defaultGeolocationAtom, { store });
  const seriesTaskInfo = useAtomValue(atomMap?.seriesTaskInfoAtom || defaultSeriesTaskInfoAtom, { store });
  const setSeriesTaskInfo = useSetAtom(atomMap?.seriesTaskInfoAtom || defaultSeriesTaskInfoAtom, { store });

  const { needPerformanceOptimization = false, apolloControl = false } =
    (typeof window !== 'undefined' && (window as any).__appConfig__) || {};
  const taskConfigs = useRef<TaskConfig[]>([]);
  const activeIndex = useRef(-1);

  const [awardList, setAwardList] = useState<BenefitResult[]>([]);
  const [showCashBack, setShowCashBack] = useState(true);
  const [mainTask, setMainTask] = useState<MainTaskResult>();
  const [prizeVisible, setPrizeVisible] = useState(false);
  const onPrizeClose = useCallback(() => {
    setPrizeVisible(false);
    setTimeout(() => {
      if (typeof window !== 'undefined' && (window as any).__common_dialog?.handleFn) {
        (window as any).__common_dialog.handleFn();
      }
    }, 500);
  }, []);

  const receiveTask = useCallback(
    async (taskId: number) => {
      const res = await taskReceive({
        taskId,
        cityId: geo.success ? geo.cityId : 0,
      });
      return res.success ? res.data : false;
    },
    [geo],
  );

  const receiveAward = useCallback(async (task: MainTaskResult) => {
    const received: BenefitResult[] = [];
    for (let i = 0; i < task.subTaskResultList.length; i += 1) {
      const subtask = task.subTaskResultList[i];
      if (subtask.taskManualRightDTO.getRightReceiveFlag) {
        const res = await taskReceiveAward({
          campaignId: task.taskCampaignId,
          beginTime: task.periodBeginTime,
          endTime: task.periodEndTime,
          subTaskId: subtask.id,
        });
        if (
          res.success &&
          res.data?.taskManualRightDTO?.benefitResult?.length > 0
        ) {
          received.push(...res.data.taskManualRightDTO.benefitResult);
        }
      }
    }
    return received;
  }, []);
  const queryReceivedAward = useCallback(async () => {
    const res = await queryAwardPopupWindow({
      campaignId,
      bizId,
      channelId: ddchn || '',
      longitude: geo.success ? geo.longitude : 0,
      latitude: geo.success ? geo.latitude : 0,
      cityId: geo.success ? geo.cityId : 0,
      checkTaskCenter: true,
    });
    if (res.success && res.data?.result?.benefitResult?.length > 0) {
      return res.data.result.benefitResult;
    }
    return [];
  }, [geo, ddchn]);

  const fetchAllAward = useCallback(
    async (task: MainTaskResult) => {
      const all = await Promise.all([receiveAward(task), queryReceivedAward()]);
      const tempData: BenefitResult[] = [];
      all.forEach((list) =>
        list.forEach((item) => {
          if (Array.isArray(item.subBenefitInfoGrantResults)) {
            const newItems = item.subBenefitInfoGrantResults.map((v) => ({
              ...v,
              isPackage: true,
            }));
            tempData.push(...newItems);
          } else {
            tempData.push(item);
          }
        }),
      );
      if (tempData.length === 0) {
        return;
      }
      const normalList: BenefitResult[] = [];
      const targetList: BenefitResult[] = [];
      const tempList: BenefitResult[] = [];
      tempData.forEach((item) => {
        const { benefitType, payMisProductId, commonAttributes } = item;
        const lastPayMisProductId = commonAttributes
          ? JSON.parse(commonAttributes).payMisProductId
          : payMisProductId;

        if (benefitType === 15 || benefitType === 35) {
          targetList.push(item);
        } else if (
          benefitType === 100 &&
          isSortToMiddlePayMisProductId(lastPayMisProductId)
        ) {
          tempList.push(item);
        } else {
          normalList.push(item);
        }
      });
      setAwardList([...normalList, ...tempList, ...targetList]);
      setPrizeVisible(true);
    },
    [receiveAward, queryReceivedAward],
  );

  const getTaskIds = useCallback(() => {
    if (!taskConfigs.current[activeIndex.current]) {
      return '';
    }
    return taskConfigs.current[activeIndex.current].subTaskConfigs
      .map((v) => v.taskId)
      .join(',');
  }, [taskConfigs, activeIndex]);

  const trackEventAttr = useMemo(() => {
    const state = mainTask?.isMultipleTask && mainTask?.multipleNum > 1 ? 1 : 0;
    return {
      task_id: getTaskIds(),
      state,
    };
  }, [mainTask]);

  const queryCurrentTaskList = useCallback(async () => {
    if (activeIndex.current === -1) {
      setShowCashBack(false);
      return;
    }
    const res = await queryTaskList({
      taskIds: getTaskIds(),
      lng: geo.success ? geo.longitude : 0,
      lat: geo.success ? geo.latitude : 0,
      cityId: geo.success ? geo.cityId : 0,
    });
    if (res.success && res.data.length > 0) {
      setMainTask(res.data[0]);
      if (
        res.data[0].subTaskResultList &&
        res.data[0].subTaskResultList.length > 0
      ) {
        if (res.data[0].subTaskResultList[0].status === 0) {
          const isReceive = await receiveTask(res.data[0].id);
          if (typeof window !== 'undefined' && (window as any).Omega) {
            (window as any).Omega.trackEvent(
              'xy_px_cashback_taskreceive_ck',
              '',
              trackEventAttr,
            );
          }
          if (isReceive) {
            queryCurrentTaskList();
            return;
          }
        }
        fetchAllAward(res.data[0]);
      }
    } else {
      setShowCashBack(false);
    }
  }, []);

  const fetchMain = useCallback(async () => {
    const res = await queryTaskCenterList({
      campaignId,
      bizId,
      channelId: ddchn || '',
      longitude: geo.success ? geo.longitude : 0,
      latitude: geo.success ? geo.latitude : 0,
      cityId: geo.success ? geo.cityId : 0,
    });
    if (
      res.success &&
      res.data?.success &&
      res.data.result?.groupTaskConfigs
    ) {
      const { groupTaskConfigs } = res.data.result;
      for (let i = 0; i < groupTaskConfigs.length; i += 1) {
        const beginTime = dayjs(groupTaskConfigs[i].beginTime).startOf('day');
        const endTime = dayjs(groupTaskConfigs[i].endTime).endOf('day');
        const currentDate = dayjs().startOf('day');
        if (!currentDate.isBefore(beginTime) && !currentDate.isAfter(endTime)) {
          activeIndex.current = i;
          break;
        }
      }
      taskConfigs.current = groupTaskConfigs;
      queryCurrentTaskList();
    } else {
      setShowCashBack(false);
    }
  }, []);

  const initFromStore = useCallback(() => {
    if (seriesTaskInfo?.groupTaskConfigs) {
      const { groupTaskConfigs } = seriesTaskInfo;
      for (let i = 0; i < groupTaskConfigs.length; i += 1) {
        const beginTime = dayjs(groupTaskConfigs[i].beginTime).startOf('day');
        const endTime = dayjs(groupTaskConfigs[i].endTime).endOf('day');
        const currentDate = dayjs().startOf('day');
        if (!currentDate.isBefore(beginTime) && !currentDate.isAfter(endTime)) {
          activeIndex.current = i;
          break;
        }
      }
      taskConfigs.current = groupTaskConfigs;
      queryCurrentTaskList();
    }
  }, [seriesTaskInfo]);

  useEffect(() => {
    // 使用 Mock 数据（开发/测试模式）
    if (__designMode === 'design' || mockData) {
      activeIndex.current = 0;
      taskConfigs.current = mockData?.taskCenter?.groupTaskConfigs ||
        queryTaskCenterListMock.data.result.groupTaskConfigs;
      setMainTask(mockData?.taskList?.[0] || listQueryMock.data[0]);
      setAwardList(mockData?.award?.benefitResult || awardMock.data.result[0].benefitResult);
    } else if (
      needPerformanceOptimization &&
      apolloControl &&
      seriesTaskInfo?.groupTaskConfigs?.length > 0
    ) {
      initFromStore();
    } else {
      fetchMain();
    }
  }, [__designMode, needPerformanceOptimization, apolloControl, mockData]);

  const WeChat = () =>
    xenv.getEnv() === 'wxmp' ||
    xenv.getEnv() === 'qjwxmp';

  const taskProcess = useMemo(() => {
    return mainTask
      ? mainTask.subTaskResultList.findIndex((item) => item.status !== 2)
      : -1;
  }, [mainTask]);

  // 骑行金btn
  const btnimage = useMemo(() => {
    if (taskProcess >= 0) {
      // 有完成的任务图片
      return WeChat()
        ? cyclingbtnimage?.completedTwoImg
        : cyclingbtnimage?.completedOneImg;
    }
    // 无完成任务的图片
    return WeChat()
      ? cyclingbtnimage?.incompleteTwoImg
      : cyclingbtnimage?.incompleteOneImg;
  }, []);

  const trackShowRef = useRef(false);

  const inViewHook = useInView({
    threshold: [0.5],
    onChange: (inView, entry) => {
      if (!trackShowRef.current && inView && entry.intersectionRatio >= 0.5) {
        trackShowRef.current = true;
        if (typeof window !== 'undefined' && (window as any).Omega) {
          (window as any).Omega.trackEvent('xy_px_cashback_sw', '', {
            ...trackEventAttr,
            process: taskProcess,
          });
        }
      }
    },
  });
  if (!showCashBack) {
    return null;
  }
  return (
    <div className={styles.container} ref={inViewHook.ref}>
      {taskConfigs.current.length > 1 ? (
        <Banner
          taskConfigs={taskConfigs.current}
          activeIndex={activeIndex.current}
          bannerimg={bannerimg}
          arrowimg={arrowimg}
          status={status}
        />
      ) : null}

      <Content
        taskConfigs={taskConfigs.current}
        activeIndex={activeIndex.current}
        taskcontent={taskcontent}
        mainTask={mainTask}
        cyclingbtnimage={btnimage}
        reminddata={reminddata}
        subscribeConfig={subscribeConfig}
        trackEventAttr={trackEventAttr}
        onMainBtnClick={() => {
          // eslint-disable-next-line no-underscore-dangle
          if (__designMode === 'design') {
            return;
          }
          if (typeof window !== 'undefined' && (window as any).Omega) {
            (window as any).Omega.trackEvent(
              'xy_px_cashback_withdraw_ck',
              '',
              trackEventAttr,
            );
          }
          goto.open(
            taskProcess > 0 ? cyclingcompletedlink : cyclingincompletelink,
          );
        }}
      />
      <Prize
        previewVisible={previewVisible}
        visible={prizeVisible}
        skinConfigure={skinConfigure}
        // @ts-ignore
        buttonConfigure={buttonConfigure}
        awardList={awardList}
        onClose={onPrizeClose}
        __designMode={__designMode}
      />
    </div>
  );
}

// 主组件导出，自动包装 Jotai Provider
export default function QjCashback(rawProps: QjCashbackProps) {
  const props = resolveQjCashbackProps(rawProps);
  const store = props.store || createStore();

  return (
    <Provider store={store}>
      <CashBackComponentInner {...props} />
    </Provider>
  );
}

// 导出类型与默认值
export type { QjCashbackProps } from './types';
export {
  DEFAULT_BANNER_IMG,
  DEFAULT_ARROW_IMG,
  DEFAULT_TASK_CONTENT,
  DEFAULT_STATUS,
  DEFAULT_CYCLING_BTN_IMAGE,
  DEFAULT_REMIND_DATA,
  DEFAULT_SKIN_CONFIGURE,
  DEFAULT_BUTTON_CONFIGURE,
  DEFAULT_QJ_CASHBACK_PROPS,
  resolveQjCashbackProps,
} from './defaults';
export type {
  IGeolocation,
  LinkConfig,
  TaskContentImages,
  CyclingButtonImages,
  SkinConfigure,
  ButtonConfigure
} from './types';
