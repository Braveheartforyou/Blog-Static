import execFunc from './lib/exec'

const PLUGIN_NAME = 'UtilPlugin'

/**
 * 运行未包含原生功能
 * @param {String} 功能所在类名
 * @param {String} 功能的方法名
 * @param {Array}  调用方法参数，以数组形式传递
 * @return {Promise}
 */
export const exec = execFunc

/**
 * 前端资源加载完成
 * @return {void} 无返回
 */
export const loadFinish = () => execFunc(PLUGIN_NAME, 'loadFinish')

/**
 * 选择图片: 拍照或选择本机图片
 * @return {Promise<string>} 图片base64字符串
 */
export const pickImage = () => execFunc(PLUGIN_NAME, 'pickImage')

/**
 * 扫码
 * @return {Promise<string>} 条码字符串
 */
export const scan = () => execFunc(PLUGIN_NAME, 'scan')

/**
 * 拍照
 * @return {Promise<string>} 图片base64字符串
 */
export const takePhoto = () => execFunc(PLUGIN_NAME, 'takePhoto')

/**
 * 本地图片
 * @return {Promise<string>} 图片base64字符串
 */
export const localPhoto = () => execFunc(PLUGIN_NAME, 'localPhoto')

/**
 * 获取经纬度
 * @return {Promise<object>} 包含经纬度对象 { lat: 12.12, lgt: 12.12 }
 */
export const getLocation = () => execFunc(PLUGIN_NAME, 'getLocation')

/**
 * 获取异形屏上下安全区尺寸
 * @return {Promise<object>} 包含上下尺寸 { top: 20, bottom: 20 }
 */
export const getNotchHeight = () => execFunc(PLUGIN_NAME, 'getNotchHeight')

export default {
  loadFinish,
  pickImage,
  scan,
  takePhoto,
  localPhoto,
  getLocation,
  getNotchHeight,
  exec
}
