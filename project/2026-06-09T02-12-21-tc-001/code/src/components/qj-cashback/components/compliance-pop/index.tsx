import * as React from 'react';
import styles from './index.module.scss';
import { Mask } from 'antd-mobile';
import cxbind from 'classnames/bind';

const cx = cxbind.bind(styles);

interface RulePopInter {
  showDialog: boolean;
  setShowDialog: (t: boolean) => void;
}
const CompliancePop = ({ showDialog, setShowDialog }: RulePopInter) => {
  return (
    <Mask
      visible={showDialog}
      getContainer={() => document.body}
      color="rgba(0,0,0,0.85)"
      destroyOnClose
    >
      {showDialog ? (
        <iframe
          src="https://page.udache.com/driver-activity-biz/baichuan-policy-agreement/index.html?mode=1&cnt_id=22050617368#/xpub"
          className={cx('mf-assist-dialog-iframe')}
        />
      ) : (
        ''
      )}
      <div
        className={cx('mf-assist-dialog-iframe-close')}
        onClick={() => {
          setShowDialog(false);
        }}
      />
    </Mask>
  );
};

export default CompliancePop;
