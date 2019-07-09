// @flow
/* eslint-disable jsx-a11y/accessible-emoji */
import React, { Component } from "react";
import Modal from "react-bootstrap/Modal";

type Props = {
  url?: string,
  content: any,
  show: any,
  onHide: Function,
  footer?: string | React$Node,
  actions?: string | React$Node
};
export default class ConfigurationModal extends Component<Props> {
  node = null;

  autoSelect = (e: any) => {
    e.target.focus();
    e.target.select();
  };

  render() {
    const {
      url,
      content,
      footer,
      show,
      actions,
      onHide
    } = this.props;
    return (
      <Modal centered backdrop onHide={onHide} show={show}>
        <Modal.Body>
          <div className="ps-2">
            <div>
              <h3 className="mt-1 mb-0 text-center">
                Configure your incoming webhook
              </h3>
              <h1 className="mt-0 mb-0 text-center">🤓</h1>
              <p>{content}</p>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <textarea
                type="text"
                onClick={this.autoSelect}
                className="form-control input-monospace credential"
                value={url}
                readOnly
                data-autoselect=""
              />
            </div>
            {footer && <div className="mb-1">{footer}</div>}
          </div>
        </Modal.Body>
        {actions && <Modal.Footer>{actions}</Modal.Footer>}
      </Modal>
    );
  }
}