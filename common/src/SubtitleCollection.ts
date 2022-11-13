import IntervalTree, { NumericTuple } from '@flatten-js/interval-tree';
import { SubtitleModel } from './Model';

export interface SubtitleSlice<T> {
    showing: T[];
    lastShown?: T[];
    startedShowing?: T;
    willStopShowing?: T;
}

export interface SubtitleCollectionOptions {
    returnLastShown: boolean;
    showingCheckRadiusMs?: number;
}

export class SubtitleCollection<T extends SubtitleModel> {
    private readonly tree: IntervalTree<T>;
    private readonly gapsTree?: IntervalTree<T>;
    private readonly showingCheckRadiusMs?: number;

    constructor(subtitles: T[], options: SubtitleCollectionOptions) {
        this.tree = new IntervalTree<T>();
        this.showingCheckRadiusMs = options.showingCheckRadiusMs;

        if (options.returnLastShown) {
            let last: T | undefined;
            this.gapsTree = new IntervalTree<T>();

            for (const s of subtitles) {
                this.tree.insert([s.start, s.end], s);

                if (last !== undefined && last.end < s.start) {
                    this.gapsTree.insert([last.end + 1, s.start - 1], last);
                }

                last = s;
            }
        } else {
            for (const s of subtitles) {
                this.tree.insert([s.start, s.end], s);
            }
        }
    }

    subtitlesAt(timestamp: number): SubtitleSlice<T> {
        const interval: NumericTuple = [timestamp, timestamp];
        const showing = this.tree.search(interval) as T[];
        let lastShown: T[] | undefined;
        let startedShowing: T | undefined;
        let willStopShowing: T | undefined;

        if (showing.length === 0) {
            if (this.gapsTree !== undefined) {
                lastShown = this.gapsTree.search(interval) as T[];
            }
        } else if (this.showingCheckRadiusMs !== undefined) {
            for (const s of showing) {
                if (willStopShowing === undefined && s.end < timestamp + this.showingCheckRadiusMs) {
                    willStopShowing = s;
                }

                if (startedShowing === undefined && timestamp - this.showingCheckRadiusMs < s.start) {
                    startedShowing = s;
                }

                if (startedShowing !== undefined && willStopShowing !== undefined) {
                    break;
                }
            }
        }

        return { showing, lastShown, startedShowing, willStopShowing };
    }
}
