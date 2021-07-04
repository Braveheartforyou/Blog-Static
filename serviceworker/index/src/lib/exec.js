// 区分平台引入 exec 方法
import { client, has } from 'xsy-plugins/utils'
import wkwebviewPatch from './wkwebviewPatch'

let exec

if (isWebview()) {
  if (has(client(), 'android')) {
    const cordova = require('xsy-cordova/android')
    exec = cordova.require('cordova/exec')
  } else {
    const cordova = require('xsy-cordova/ios')
    wkwebviewPatch(cordova)
    exec = cordova.require('cordova/exec')
  }
} else {
  console.log('[cordova-plugins]: cordova does not exsit, faker exec function!')
  exec = function (succCall) {
    succCall('Faker success function!')
  }
}

export default function (className, methodName, params) {
  return new Promise((resolve, reject) => {
    exec(resolve, reject, className, methodName, params || [])
  })
}

export function isWebview () {
  const { userAgent } = window.navigator
  const androidWv = has(userAgent, 'Linux') && has(userAgent, 'Crosswalk')
  const iosWv = has(userAgent, 'WKWebView')

  return iosWv || androidWv
}
