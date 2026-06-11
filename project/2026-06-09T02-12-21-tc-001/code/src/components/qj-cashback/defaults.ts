/**
 * 默认值与 xmf-material-mono/apps/mf-qj-cashback/lowcode/mf-qj-cashback/meta.ts
 * 中 setter.initialValue 对齐。
 */
import type {
  ButtonConfigure,
  CyclingButtonImages,
  LinkConfig,
  QjCashbackProps,
  SkinConfigure,
  TaskContentImages,
} from './types';

const CDN = 'https://img-hxy021.didistatic.com/static/starimg';

const DEFAULT_LINK: LinkConfig = {
  wxmp: '',
  alimp: '',
  qjwxmp: '',
  passenger: '',
};

export const DEFAULT_BANNER_IMG = `${CDN}/img/zIbOZV4n5n1692857593023.png`;
export const DEFAULT_ARROW_IMG = `${CDN}/img/t8Fd78I23E1692857645258.png`;

export const DEFAULT_TASK_CONTENT: TaskContentImages = {
  taskContentOneImg: `${CDN}/img/v5yzLC2IXc1692857655304.png`,
  taskContentMoreImg: `${CDN}/img/KQOWIZFa6k1692857651983.png`,
};

export const DEFAULT_STATUS: Record<string, string> = {
  noHitTask: `${CDN}/img/iOOuMhczTn1692847902566.png`,
  ongoing: `${CDN}/img/32ArL84Vm31692847852502.png`,
  finished: `${CDN}/img/QlmxGcUwKX1692847782192.png`,
};

export const DEFAULT_CYCLING_BTN_IMAGE: CyclingButtonImages = {
  incompleteOneImg: `${CDN}/img/mMwEiyFJgV1692857264565.png`,
  incompleteTwoImg: `${CDN}/img/6t6HyDr8wa1692857158980.png`,
  completedOneImg: `${CDN}/img/gElqL6EKQe1691129122622.png`,
  completedTwoImg: `${CDN}/img/4z8izWU5ii1691129108103.png`,
};

export const DEFAULT_REMIND_DATA = {
  remindImage: `${CDN}/img/kqIWw7ynXk1692857287653.png`,
};

export const DEFAULT_SKIN_CONFIGURE: SkinConfigure = {
  headImgUrl: `${CDN}/img/z1G6Bq7lRr1710233703724.png`,
  headImgAuthUrl: `${CDN}/img/4DjwEuvjqn1710233697530.png`,
  rewardItemImgUrl: `${CDN}/node/udYiiL6fMP1678260062121.png`,
  rewardDefaultImgUrl: `${CDN}/img/vjOMXpSoNI1691146707804.png`,
  rewardDoubleImgUrl: `${CDN}/img/VzaNLDJaM61692858759167.png`,
};

const DEFAULT_DIALOG_BUTTON_IMG = `${CDN}/img/qrVEawKrZ41700817727426.png`;

export const DEFAULT_BUTTON_CONFIGURE: ButtonConfigure = {
  close: {
    buttonImg: DEFAULT_DIALOG_BUTTON_IMG,
    buttonAuthImg: `${CDN}/img/z4nNL8zlsW1708936036788.png`,
  },
  subscribe: {
    dialogSubscribeConfig: {
      scene: '',
      pageImage: '',
      buttonImage: '',
    },
    buttonImg: DEFAULT_DIALOG_BUTTON_IMG,
    buttonAuthImg: `${CDN}/img/Hx352S06WF1708936036755.png`,
  },
  link: {
    linkConfig: { ...DEFAULT_LINK },
    buttonImg: DEFAULT_DIALOG_BUTTON_IMG,
    buttonAuthImg: `${CDN}/img/Hx352S06WF1708936036755.png`,
  },
};

export const DEFAULT_QJ_CASHBACK_PROPS: Partial<QjCashbackProps> = {
  previewVisible: false,
  priority: 3,
  bannerimg: DEFAULT_BANNER_IMG,
  arrowimg: DEFAULT_ARROW_IMG,
  taskcontent: { ...DEFAULT_TASK_CONTENT },
  status: { ...DEFAULT_STATUS },
  cyclingbtnimage: { ...DEFAULT_CYCLING_BTN_IMAGE },
  cyclingincompletelink: { ...DEFAULT_LINK },
  cyclingcompletedlink: { ...DEFAULT_LINK },
  reminddata: { ...DEFAULT_REMIND_DATA },
  skinConfigure: { ...DEFAULT_SKIN_CONFIGURE },
  buttonConfigure: DEFAULT_BUTTON_CONFIGURE,
};

export function resolveQjCashbackProps(props: QjCashbackProps): QjCashbackProps {
  const buttonConfigure = props.buttonConfigure
    ? {
        ...DEFAULT_BUTTON_CONFIGURE,
        ...props.buttonConfigure,
        close: props.buttonConfigure.close
          ? { ...DEFAULT_BUTTON_CONFIGURE.close!, ...props.buttonConfigure.close }
          : DEFAULT_BUTTON_CONFIGURE.close,
        subscribe: props.buttonConfigure.subscribe
          ? {
              ...DEFAULT_BUTTON_CONFIGURE.subscribe!,
              ...props.buttonConfigure.subscribe,
              dialogSubscribeConfig: {
                ...DEFAULT_BUTTON_CONFIGURE.subscribe!.dialogSubscribeConfig,
                ...props.buttonConfigure.subscribe.dialogSubscribeConfig,
              },
            }
          : DEFAULT_BUTTON_CONFIGURE.subscribe,
        link: props.buttonConfigure.link
          ? {
              ...DEFAULT_BUTTON_CONFIGURE.link!,
              ...props.buttonConfigure.link,
              linkConfig: {
                ...DEFAULT_BUTTON_CONFIGURE.link!.linkConfig,
                ...props.buttonConfigure.link.linkConfig,
              },
            }
          : DEFAULT_BUTTON_CONFIGURE.link,
      }
    : DEFAULT_BUTTON_CONFIGURE;

  return {
    ...DEFAULT_QJ_CASHBACK_PROPS,
    ...props,
    previewVisible: props.previewVisible ?? DEFAULT_QJ_CASHBACK_PROPS.previewVisible,
    priority: props.priority ?? DEFAULT_QJ_CASHBACK_PROPS.priority,
    bannerimg: props.bannerimg || DEFAULT_BANNER_IMG,
    arrowimg: props.arrowimg || DEFAULT_ARROW_IMG,
    taskcontent: { ...DEFAULT_TASK_CONTENT, ...props.taskcontent },
    status: { ...DEFAULT_STATUS, ...props.status },
    cyclingbtnimage: { ...DEFAULT_CYCLING_BTN_IMAGE, ...props.cyclingbtnimage },
    cyclingincompletelink: { ...DEFAULT_LINK, ...props.cyclingincompletelink },
    cyclingcompletedlink: { ...DEFAULT_LINK, ...props.cyclingcompletedlink },
    reminddata: { ...DEFAULT_REMIND_DATA, ...(props.reminddata as typeof DEFAULT_REMIND_DATA) },
    skinConfigure: { ...DEFAULT_SKIN_CONFIGURE, ...props.skinConfigure },
    buttonConfigure,
  };
}
