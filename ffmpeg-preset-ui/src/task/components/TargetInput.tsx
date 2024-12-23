import { type JSX } from 'solid-js';
import { Fa } from 'solid-fa';
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons';

import { BrowseInput } from '../../components/BrowseInput';

import './TargetInput.scss';

export interface TargetInputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  source: string;
  onChange: (value: string) => void;
}

const STRIP_FILENAME_REGEX = /^(.*[\/\\]).*/;

export function TargetInput(props: TargetInputProps) {
  const handleChange = (value: string) => {
    props.onChange(value);
  };

  const handleChooseFile = (file: string | string[] | null) => {
    if (!file) {
      return;
    }

    handleChange(file as string);
  };

  const handleFromSource = () => {
    if (!props.source) {
      return;
    }

    const target = props.source.replace(STRIP_FILENAME_REGEX, '$1');
    handleChange(target);
  };

  return (
    <BrowseInput
      fileBrowseProps={{
        title: 'Choose target file folder',
        directory: true,
        defaultPath: props.value as string,
        button: {
          mode: 'icon',
        },
      }}
      {...props}
      value={props.value}
      renderSuffix={() => (
        <button
          type="button"
          title="Copy from source"
          class="only-icon"
          onClick={handleFromSource}
        ><Fa icon={faRightFromBracket} /></button>
      )}
      onChange={handleChange}
      onChooseFile={handleChooseFile}
    />
  );
}