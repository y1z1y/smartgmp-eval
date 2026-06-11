// SDK Mock 注入（必须在 import 组件之前执行）
if (typeof window !== 'undefined') {
  const noop = () => {};
  const noopAsync = async () => ({ success: true });
  if (!window.htwSdk) {
    (window as any).htwSdk = {
      xenv: { getEnv: () => 'h5' as const },
      url: {
        getAllQuery: (_url: string) => ({ campaignId: '10289487', bizId: '363', ddchn: '' }),
        getSupportedImgSrc: (src: string) => src,
      },
      goto: { open: noopAsync },
      share: { clickShare: noop },
      subscribe: { subscribe: noop },
      user: {
        getUserInfo: async () => ({ login: false }),
        login: async () => ({ login: false }),
        logout: async () => ({ login: false }),
      },
      geo: {
        getCurrentPosition: async () => ({ success: false }),
        getCityId: async () => 0,
      },
      kop: {
        http: null,
        instance: null,
        send: async () => ({ data: { code: 200, data: null } }),
      },
      initWsgsdk: async () => {},
    };
  }
  if (!(window as any).__mf_sdk__) {
    (window as any).__mf_sdk__ = { insertAndStartPopQueue: noop };
  }
  if (!(window as any).Omega) {
    (window as any).Omega = {
      setConfig: noop,
      trackEvent: (eventId: string, label?: string, attrs?: any) => {
        console.log('[Omega mock]', eventId, label, attrs);
      },
    };
  }
}

import React from 'react';
import '@smartgmp-components/qj-cashback/dist/index.css';
import QjCashback from '@smartgmp-components/qj-cashback';
import HeadImg from '@smartgmp-components/head-img';
import './index.scss';

// Mock 数据（时间戳使用动态计算的未来值）
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const DAY = 86400000;
const todayMs = today.getTime();

const mockData = {
  taskList: [
    {
      eventNameList: ['HTW_ORDER_STATUS_CHANGE_COMPLETION'],
      originTaskType: 1,
      taskSceneType: 0,
      issuedAward: '0',
      vehicleCategory: 0,
      taskType: 1,
      subTitle: '秋季分组2人群1副',
      bizId: '363',
      beginTime: todayMs,
      periodBeginTime: todayMs,
      id: 1010247500,
      subTaskResultList: [
        {
          taskSeq: 0,
          progressRate: { totalValue: 1, currentValue: 0 },
          taskButton: '',
          subTaskPic: '',
          getRightReceiveFlag: false,
          taskManualRightDTO: {
            receiveDeadline: todayMs + DAY * 7,
            rightTypeList: ['COMMON_RIDING_CRASH', 'COMMON_REDPACKET'],
            getRightReceiveFlag: false,
            rightName: '优惠券',
            awards: [
              { name: '红包', subType: 20, type: 'PRIVILEGE', value: 23444, extValue: 1 },
            ],
            isSingleRedpacket: false,
          },
          subTitle: '得奖励',
          taskUrl: 'home',
          mainTitle: '骑1单',
          end: todayMs + DAY * 7,
          taskInstructions: '<p style="color: rgb(68, 68, 68);"><br></p>',
          id: 0,
          begin: todayMs,
          status: 0,
        },
        {
          taskSeq: 1,
          progressRate: { totalValue: 2, currentValue: 0 },
          taskButton: '',
          subTaskPic: '',
          getRightReceiveFlag: false,
          taskManualRightDTO: {
            receiveDeadline: todayMs + DAY * 7,
            rightTypeList: ['DIDI_VOUCHER_PACKAGE', 'PLOIDY_CARD'],
            getRightReceiveFlag: false,
            rightName: '大礼包',
            awards: [
              { name: '秋季营销折扣券', subType: 100, type: 'PRIVILEGE', value: 55090991, extValue: 1 },
            ],
            isSingleRedpacket: false,
          },
          subTitle: '得优惠券',
          taskUrl: 'home',
          mainTitle: '骑2单',
          end: todayMs + DAY * 7,
          taskInstructions: '<p style="color: rgb(68, 68, 68);"><br></p>',
          id: 1,
          begin: todayMs + DAY,
          status: 0,
        },
        {
          taskSeq: 2,
          progressRate: { totalValue: 3, currentValue: 0 },
          taskButton: '',
          subTaskPic: '',
          getRightReceiveFlag: false,
          taskManualRightDTO: {
            receiveDeadline: todayMs + DAY * 7,
            rightTypeList: ['COMMON_BIKE_CARD', 'COMMON_REDPACKET', 'BENEFIT_PACKAGE'],
            getRightReceiveFlag: false,
            rightName: '大礼包',
            awards: [
              { name: '3元现金红包', subType: 20, type: 'PRIVILEGE', value: 22907, extValue: 1 },
            ],
            isSingleRedpacket: false,
          },
          subTitle: '得大奖',
          taskUrl: 'home',
          mainTitle: '骑3单',
          end: todayMs + DAY * 7,
          taskInstructions: '<p style="color: rgb(68, 68, 68);"><br></p>',
          id: 2,
          begin: todayMs + DAY,
          status: 0,
        },
      ],
      isMultipleTask: true,
      periodEndTime: todayMs + DAY * 7,
      categoryCode: 'RIDING',
      priority: 1,
      multipleAward: {
        awardDetail: [
          { isSingleRedpacket: false, subTaskId: 0 },
          { isSingleRedpacket: false, subTaskId: 1 },
          { isSingleRedpacket: false, subTaskId: 2 },
        ],
        issuedAward: '0',
      },
      taskWay: 2,
      mainTitle: '秋季营销测试',
      taskCampaignId: 10102475,
      taskPeriod: 1,
      endTime: todayMs + DAY * 7,
      teamType: 1,
      status: 1,
    },
  ],
  taskCenter: {
    groupTaskConfigs: [
      {
        subTaskConfigs: [
          { taskName: '2023秋季营销测试', taskId: 10102171 },
          { taskName: '2023秋季营销测试无人群', taskId: 10102475 },
        ],
        endTime: todayMs + DAY,
        beginTime: todayMs,
        showDoubleImage: true,
        title: '第一天',
        awardText: '3元',
      },
      {
        subTaskConfigs: [
          { taskName: '2023秋季营销测试', taskId: 10102171 },
          { taskName: '2023秋季营销测试无人群', taskId: 10102475 },
        ],
        endTime: todayMs + DAY * 2,
        beginTime: todayMs + DAY,
        showDoubleImage: true,
        title: '第二天',
        awardText: '3元',
      },
      {
        subTaskConfigs: [
          { taskName: '2023秋季营销测试', taskId: 10102171 },
          { taskName: '2023秋季营销测试无人群', taskId: 10102475 },
        ],
        endTime: todayMs + DAY * 3,
        beginTime: todayMs + DAY * 2,
        showDoubleImage: true,
        title: '第三天',
        awardText: '3元',
      },
    ],
  },
};

// 默认图片配置
const defaultImageProps = {
  bannerimg: 'https://img-hxy021.didistatic.com/static/starimg/img/zIbOZV4n5n1692857593023.png',
  arrowimg: 'https://img-hxy021.didistatic.com/static/starimg/img/t8Fd78I23E1692857645258.png',
  taskcontent: {
    taskContentOneImg: 'https://img-hxy021.didistatic.com/static/starimg/img/v5yzLC2IXc1692857655304.png',
    taskContentMoreImg: 'https://img-hxy021.didistatic.com/static/starimg/img/KQOWIZFa6k1692857651983.png',
  },
  status: {
    noHitTask: 'https://img-hxy021.didistatic.com/static/starimg/img/iOOuMhczTn1692847902566.png',
    ongoing: 'https://img-hxy021.didistatic.com/static/starimg/img/32ArL84Vm31692847852502.png',
    finished: 'https://img-hxy021.didistatic.com/static/starimg/img/QlmxGcUwKX1692847782192.png',
  },
  cyclingbtnimage: {
    incompleteOneImg: 'https://img-hxy021.didistatic.com/static/starimg/img/mMwEiyFJgV1692857264565.png',
    incompleteTwoImg: 'https://img-hxy021.didistatic.com/static/starimg/img/6t6HyDr8wa1692857158980.png',
    completedOneImg: 'https://img-hxy021.didistatic.com/static/starimg/img/gElqL6EKQe1691129122622.png',
    completedTwoImg: 'https://img-hxy021.didistatic.com/static/starimg/img/4z8izWU5ii1691129108103.png',
  },
  reminddata: {
    remindImage: 'https://img-hxy021.didistatic.com/static/starimg/img/kqIWw7ynXk1692857287653.png',
  },
  skinConfigure: {
    headImgUrl: 'https://img-hxy021.didistatic.com/static/starimg/img/z1G6Bq7lRr1710233703724.png',
    headImgAuthUrl: 'https://img-hxy021.didistatic.com/static/starimg/img/4DjwEuvjqn1710233697530.png',
    rewardItemImgUrl: 'https://img-hxy021.didistatic.com/static/starimg/node/udYiiL6fMP1678260062121.png',
    rewardDefaultImgUrl: 'https://img-hxy021.didistatic.com/static/starimg/img/vjOMXpSoNI1691146707804.png',
    rewardDoubleImgUrl: 'https://img-hxy021.didistatic.com/static/starimg/img/VzaNLDJaM61692858759167.png',
  },
};

// 链接配置
const linkConfig = {
  wxmp: '/pages/home/home',
  alimp: '/pages/home/home',
  qjwxmp: '/pages/home/home',
  passenger: 'didipasenger://home',
};

export default function RidingCashbackPage() {
  return (
    <div className="qj-cashback-page">
      <div className="page-container">
        {/* 活动头图 */}
        <div className="head-img-wrapper">
          <HeadImg
            src=""
            backgroundColor="#1677ff"
          />
        </div>

        {/* 骑行返现组件 */}
        <div className="cashback-wrapper">
          <QjCashback
            {...defaultImageProps}
            cyclingincompletelink={linkConfig}
            cyclingcompletedlink={linkConfig}
            mockData={mockData}
            __designMode="design"
            previewVisible={false}
            priority={3}
          />
        </div>
      </div>
    </div>
  );
}
