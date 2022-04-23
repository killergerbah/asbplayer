import { CompositeBuffer, Uint8ArrayBuffer } from './buffer';

it('correctly indexes', () => {
    const composite = new CompositeBuffer([
        new Uint8ArrayBuffer(Uint8Array.from([1, 2])),
        new Uint8ArrayBuffer(Uint8Array.from([3, 4])),
    ]);
    expect(composite.at(0)).toEqual(1);
    expect(composite.at(1)).toEqual(2);
    expect(composite.at(2)).toEqual(3);
    expect(composite.at(3)).toEqual(4);
});

it('correctly subarrays 1', () => {
    const composite = new CompositeBuffer([
        new Uint8ArrayBuffer(Uint8Array.from([1, 2])),
        new Uint8ArrayBuffer(Uint8Array.from([3, 4])),
    ]);
    const subarray = composite.subarray(1, 3);
    expect(subarray.at(0)).toEqual(2);
    expect(subarray.at(1)).toEqual(3);
    expect(subarray.length).toEqual(2);
});

it('correctly subarrays 2', () => {
    const composite = new CompositeBuffer([
        new Uint8ArrayBuffer(Uint8Array.from([1, 2])),
        new Uint8ArrayBuffer(Uint8Array.from([3, 4])),
    ]);
    const subarray = composite.subarray(0, 2);
    expect(subarray.at(0)).toEqual(1);
    expect(subarray.at(1)).toEqual(2);
    expect(subarray.length).toEqual(2);
});


it('correctly subarrays 3', () => {
    const composite = new CompositeBuffer([
        new Uint8ArrayBuffer(Uint8Array.from([1, 2])),
        new Uint8ArrayBuffer(Uint8Array.from([3, 4])),
    ]);
    const subarray = composite.subarray(2, 4);
    expect(subarray.at(0)).toEqual(3);
    expect(subarray.at(1)).toEqual(4);
    expect(subarray.length).toEqual(2);
});

it('correctly subarrays 4', () => {
    const composite = new CompositeBuffer([
        new Uint8ArrayBuffer(Uint8Array.from([1, 2])),
        new Uint8ArrayBuffer(Uint8Array.from([3, 4])),
    ]);
    const subarray = composite.subarray(0, 1);
    expect(subarray.at(0)).toEqual(1);
    expect(subarray.length).toEqual(1);
});

it('correctly subarrays 5', () => {
    const composite = new CompositeBuffer([
        new Uint8ArrayBuffer(Uint8Array.from([1, 2])),
        new Uint8ArrayBuffer(Uint8Array.from([3, 4])),
    ]);
    const subarray = composite.subarray(2, 3);
    expect(subarray.at(0)).toEqual(3);
    expect(subarray.length).toEqual(1);
});