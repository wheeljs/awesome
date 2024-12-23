import { type JSX } from 'solid-js';
import { Fa } from 'solid-fa';
import { omit } from 'lodash-es';
import { faFolderOpen } from '@fortawesome/free-regular-svg-icons';
import { open, type OpenDialogOptions } from '@tauri-apps/plugin-dialog';

import './BrowseInput.scss';

type BrowseFileButtonRenderProps = {
  onClick: (event: MouseEvent) => void;
};

type BrowseFileButtonProps = {
  mode?: 'normal' | 'icon';
  render?: (props: BrowseFileButtonRenderProps) => JSX.Element;
};

interface BrowseInputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  fileBrowseProps?: OpenDialogOptions & {
    button?: BrowseFileButtonProps;
  };
  renderSuffix?: () => JSX.Element;
  onChange: (value: string) => void;
  onChooseFile: (result: string | string[] | null) => void;
}

function renderFileBrowseButton(props: BrowseFileButtonProps & BrowseFileButtonRenderProps) {
  if (typeof props.render === 'function') {
    const { mode, render, ...rest } = props;
    return props.render(rest);
  }

  const cls = [
    props.mode === 'icon' ? 'only-icon' : null,
  ].filter(x => x).join(' ');

  if (props.mode === 'icon') {
    return <button class={cls} type="button" title="Browse" onClick={props.onClick}><Fa icon={faFolderOpen} /></button>;
  }

  return <button class={cls} type="button" onClick={props.onClick}>Browse</button>;
}

export function BrowseInput(props: BrowseInputProps) {
  const inputProps = omit(props, 'fileBrowseProps', 'renderSuffix', 'onChange', 'onChooseFile');
  let input!: HTMLInputElement;

  const handleChange: JSX.ChangeEventHandler<HTMLInputElement, Event> = (event) => {
    props.onChange(event.target.value);
  };

  const handleBrowse = () => {
    open(props.fileBrowseProps)
      .then((result) => {
        if (result) {
          props.onChooseFile(result);
        }
      })
      .catch((err) => {
        console.group('open');
        console.error(err);
        console.groupEnd();
      });
  };

  return (
    <div class="browse-input">
      <input ref={input} {...inputProps} value={props.value} onChange={handleChange} />
      {renderFileBrowseButton({
        ...(props.fileBrowseProps?.button ?? {}),
        onClick: handleBrowse,
      })}
      {props.renderSuffix?.()}
    </div>
  );
}
