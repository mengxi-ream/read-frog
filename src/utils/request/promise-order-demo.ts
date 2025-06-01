// // 演示 Promise 链执行顺序
// async function demonstratePromiseOrder() {
//   console.log('=== Promise 执行顺序演示 ===')

//   // 模拟原始请求函数
//   function requestFn() {
//     return new Promise((resolve) => {
//       setTimeout(() => {
//         console.log('1. 原始 Promise resolve')
//         resolve('data')
//       }, 100)
//     })
//   }

//   console.log('\n--- 旧实现（问题版本）---')
//   function oldImplementation() {
//     const promise = requestFn()

//     // 问题：我们的清理逻辑会先执行
//     promise
//       .then((result) => {
//         console.log('2. 队列清理逻辑执行（过早）')
//         return result
//       })

//     return promise // 返回原始 promise
//   }

//   const oldPromise = oldImplementation()
//   oldPromise.then((result) => {
//     console.log('3. 用户逻辑处理结果:', result)
//   })

//   await oldPromise

//   console.log('\n--- 新实现（修复版本）---')
//   function newImplementation() {
//     const originalPromise = requestFn()

//     // 创建新的 promise 链，包含清理逻辑
//     const promiseWithCleanup = originalPromise
//       .then((result) => {
//         console.log('2. 原始结果传递给用户')
//         return result
//       })
//       .catch((error) => {
//         throw error
//       })
//       .finally(() => {
//         console.log('4. 队列清理逻辑执行（正确时机）')
//       })

//     return promiseWithCleanup // 返回带清理的 promise
//   }

//   const newPromise = newImplementation()
//   newPromise.then((result) => {
//     console.log('3. 用户逻辑处理结果:', result)
//   })

//   await newPromise
// }

// // 更进一步：使用 finally 的最佳实践版本
// async function demonstrateFinallyApproach() {
//   console.log('\n=== 使用 finally 的最佳实践 ===')

//   function requestFn() {
//     return new Promise((resolve) => {
//       setTimeout(() => {
//         console.log('1. 请求完成')
//         resolve('result')
//       }, 100)
//     })
//   }

//   function bestPracticeImplementation() {
//     const originalPromise = requestFn()

//     // 使用 finally 确保清理逻辑总是在最后执行
//     const promiseWithCleanup = originalPromise
//       .finally(() => {
//         console.log('3. 清理逻辑执行（无论成功失败）')
//       })

//     return promiseWithCleanup
//   }

//   const promise = bestPracticeImplementation()

//   promise.then((result) => {
//     console.log('2. 用户处理结果:', result)
//   })

//   await promise
// }

// // 运行所有演示
// async function runAllDemos() {
//   await demonstratePromiseOrder()
//   await demonstrateFinallyApproach()
// }

// export { runAllDemos }
