// tsx needs os.userInfo().username to choose its temporary directory.
// Some managed Windows environments make libuv's native profile lookup fail
// with ENOMEM even though USERNAME is available. Keep the fallback process-local.
const os = require('node:os');
const nativeUserInfo = os.userInfo;

os.userInfo = function userInfo(options) {
  try {
    return nativeUserInfo(options);
  } catch (error) {
    if (error?.syscall !== 'uv_os_get_passwd' || process.platform !== 'win32') {
      throw error;
    }

    const username = process.env.USERNAME || process.env.USER;
    if (!username) throw error;
    return { username };
  }
};
