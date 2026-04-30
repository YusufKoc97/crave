import { ICON_COMPONENTS, type Addiction } from '@/constants/addictions';

type Props = {
  addiction: Pick<Addiction, 'iconLib' | 'iconName'>;
  size: number;
  color: string;
};

export function AddictionGlyph({ addiction, size, color }: Props) {
  const Comp = ICON_COMPONENTS[addiction.iconLib];
  return <Comp name={addiction.iconName as never} size={size} color={color} />;
}
