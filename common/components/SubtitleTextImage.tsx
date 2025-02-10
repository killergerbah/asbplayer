import { SubtitleModel } from '..';

interface Props {
    subtitle: SubtitleModel;
    availableWidth: number;
    scale: number;
}

export default function SubtitleTextImage({ subtitle, availableWidth, scale }: Props) {
    if (subtitle.textImage === undefined) {
        return null;
    }

    const imageScale = (scale * availableWidth) / subtitle.textImage.screen.width;
    const width = imageScale * subtitle.textImage.image.width;

    return (
        <div style={{ maxWidth: width, margin: 'auto' }}>
            <img style={{ width: '100%' }} alt="subtitle" src={subtitle.textImage.dataUrl} />
        </div>
    );
}
