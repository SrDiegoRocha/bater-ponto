import { parseMoney } from './money';

it.each([
  ['25,50', 25.5],
  ['25.50', 25.5],
  ['1.234,56', 1234.56],
  ['R$ 30', 30],
  ['', null],
  ['abc', null],
])('parseMoney(%s) = %s', (text, expected) => expect(parseMoney(text)).toBe(expected));
