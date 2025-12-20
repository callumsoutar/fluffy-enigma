declare module 'round-to' {
  /**
   * Round a number to a specified number of decimal places
   * @param value - The number to round
   * @param decimals - The number of decimal places (default: 0)
   * @returns The rounded number
   */
  function roundTo(value: number, decimals?: number): number;
  export default roundTo;
}

