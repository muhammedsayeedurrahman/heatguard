/**
 * HeatGuard - Scientific Heat Stress & WBGT Calculation Engine.
 * Single source of truth lives in backend/src/core so the browser and AWS Lambda
 * run byte-identical physics.
 */
export * from '../../backend/src/core/wbgtMath.js';
