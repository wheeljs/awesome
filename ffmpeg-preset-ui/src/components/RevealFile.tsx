import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { Fa } from 'solid-fa';
import { faUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';

import { restoreUnixPath } from '../utils/utils';

import './RevealFile.scss';

type RevealFileProps = {
  file: string;
};

export function RevealFile(props: RevealFileProps) {
  const onClick = (event: Event) => {
    event.preventDefault();
    revealItemInDir(restoreUnixPath(props.file));
  };

  return (<span class="reveal-file" onClick={onClick}><a>{props.file}</a><Fa icon={faUpRightFromSquare} /></span>);
}
