import { timeDurationDisplay } from './util';

it('correctly displays timestamps less than 100 ms', () => {
    expect(timeDurationDisplay(50, 100, true)).toEqual('00:00.050');
});

it('correctly displays timestamps less than 100 ms (2)', () => {
    expect(timeDurationDisplay(1, 100, true)).toEqual('00:00.001');
});

it('correctly displays timestamps less than 100 ms (3)', () => {
    expect(timeDurationDisplay(99, 99, true)).toEqual('00:00.099');
});

it('correctly displays timestamps', () => {
    expect(timeDurationDisplay(999, 1000, true)).toEqual('00:00.999');
});

it('correctly displays timestamps (2)', () => {
    expect(timeDurationDisplay(1250, 1250, true)).toEqual('00:01.250');
});
