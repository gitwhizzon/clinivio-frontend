import { cn, formatCurrency, formatDate, formatTime, getInitials, debounce } from './utils';

describe('cn', () => {
  it('merges class names and resolves Tailwind conflicts', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });
});

describe('formatCurrency', () => {
  it('formats a number as INR with no decimals by default', () => {
    expect(formatCurrency(1500)).toBe('₹1,500');
  });

  it('supports a different currency', () => {
    expect(formatCurrency(1500, 'USD')).toContain('1,500');
  });

  it('rounds to whole units', () => {
    expect(formatCurrency(999.6)).toBe('₹1,000');
  });
});

describe('formatDate', () => {
  it('formats a date string in the default dd MMM yyyy format', () => {
    expect(formatDate('2026-01-15')).toBe('15 Jan 2026');
  });

  it('accepts a Date object and a custom format string', () => {
    expect(formatDate(new Date(2026, 0, 15), 'yyyy-MM-dd')).toBe('2026-01-15');
  });
});

describe('formatTime', () => {
  it('formats a date as 12-hour time with am/pm', () => {
    const d = new Date(2026, 0, 15, 14, 30);
    expect(formatTime(d)).toBe('02:30 PM');
  });
});

describe('getInitials', () => {
  it('returns uppercase first letters of first and last name', () => {
    expect(getInitials('sam', 'doctor')).toBe('SD');
  });

  it('uppercases even when names are already capitalized', () => {
    expect(getInitials('Priya', 'Nurse')).toBe('PN');
  });
});

describe('debounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('only invokes the function once after the delay, using the latest args', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 200);

    debounced('first');
    debounced('second');
    debounced('third');

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('third');
  });

  it('resets the timer on each call within the delay window', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 200);

    debounced();
    jest.advanceTimersByTime(150);
    debounced();
    jest.advanceTimersByTime(150);

    // 300ms elapsed total, but the timer was reset at 150ms — still shouldn't have fired
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
