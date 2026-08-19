"use strict";
importScripts('../7z/js7z.js');
// 用于向主线程发送状态更新
const sendStatus = (message) => {
	self.postMessage({
		type: 'status',
		data: message
	});
}
// 用于向主线程发送错误
const sendError = (error) => {
	self.postMessage({
		type: 'error',
		error: error.message || error
	});
}
// 辅助函数：格式化字节数（B/KB/MB）
const formatBytes = (bytes) => {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB'];
	// 防止超出单位数组最大下标
	const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
	return parseFloat((bytes / Math.pow(k, idx)).toFixed(2)) + ' ' + sizes[idx];
}
// 分段执行函数，用于避免长时间阻塞主线程
const runInSlices = async (task) => {
	const taskIterator = task();
	const executeSlice = async () => {
		let startTime = performance.now();
		let result;
		do {
			result = taskIterator.next();
			if (result.done) break;
		} while (performance.now() - startTime < 50);
		if (!result.done) {
			await new Promise(resolve => setTimeout(resolve, 10));
			return executeSlice();
		}
		return result.value;
	}
	return executeSlice();
}
// 核心处理函数
(async () => {
	// 定义文件名
	const zName = 'data';
	const path = '../' + zName + '/' + zName + '.7z';
	let js7z, cache, buffer;
	try {
		// 初始化JS7z实例
		sendStatus('正在初始化...');
		js7z = await JS7z({
			locateFile: () => '../7z/js7z.wasm',
			print: (str) => {
				if (str.trim().length > 0) {
					console.log(str);
					sendStatus(str);
				}
			},
			printErr: (str) => {
				if (str.trim().length > 0) {
					console.error(str);
					sendStatus(str);
				}
			},
			noExitRuntime: true
		});
		if (!js7z) throw new Error('初始化失败！');
		// 打开缓存
		sendStatus('正在检查缓存...');
		cache = await caches.open('GameData');
		buffer = await cache.match(zName);
		// 缓存存在则直接使用，不存在则下载
		if (buffer) {
			sendStatus("正在从缓存加载数据包");
			buffer = new Uint8Array(await buffer.arrayBuffer());
		} else {
			// 先发送HEAD请求获取文件信息（总大小）
			sendStatus('正在获取文件信息...');
			let totalSize = 0;
			try {
				const headResponse = await fetch(path, {
					method: 'HEAD'
				});
				if (headResponse.ok) {
					totalSize = Number(headResponse.headers.get('Content-Length')) || 0;
				}
			} catch (e) {
				console.warn('HEAD请求失败，将直接下载:', e.message);
			}
			// 单线程流式下载
			sendStatus('正在下载数据...');
			const response = await fetch(path);
			if (!response.ok) throw new Error(`下载失败：${response.status} ${response.statusText}`);
			const reader = response.body.getReader();
			let chunks = [];
			let totalReceived = 0;
			while (true) {
				const {
					done,
					value
				} = await reader.read();
				if (done) break;
				chunks.push(value);
				totalReceived += value.length;
				// 显示下载进度
				if (totalSize) {
					sendStatus(
						`数据下载中...(${formatBytes(totalReceived)}/${formatBytes(totalSize)}) ${Math.floor((totalReceived / totalSize) * 100)}%`
					);
				} else {
					sendStatus(`数据下载中...(${formatBytes(totalReceived)})`);
				}
				await new Promise(resolve => setTimeout(resolve, 0));
			}
			// 合并所有数据块为完整文件
			sendStatus('数据下载完成，正在合并...');
			buffer = new Uint8Array(totalReceived);
			let position = 0;
			for (const chunk of chunks) {
				buffer.set(chunk, position);
				position += chunk.length;
			}
			// 写入缓存
			sendStatus("正在写入缓存");
			await cache.put(zName, new Response(buffer, {
				headers: {
					'Content-Type': 'application/x-7z-compressed',
					'Content-Length': totalSize || totalReceived
				}
			}));
		}
		if (!buffer) throw new Error('压缩包数据为空');
		// 分块写入7z内存文件系统
		sendStatus("正在准备写入数据");
		await runInSlices(function*() {
			let stream = null;
			try {
				stream = js7z.FS.open(zName, 'w+');
				const blen = buffer.length;
				let position = 0;
				while (position < blen) {
					const end = Math.min(position + 1024 * 1024, blen);
					const chunk = buffer.subarray(position, end);
					js7z.FS.write(stream, chunk, 0, chunk.length);
					position = end;
					const writePercent = Math.floor((position / blen) * 100);
					sendStatus(`正在写入数据... ${writePercent}%`);
					yield;
				}
			} finally {
				if (stream) {
					js7z.FS.close(stream);
				}
			}
		});
		// 执行解压
		sendStatus("正在解压数据...");
		js7z.callMain(['x', zName, '-p2585649532', '-aoa', '-y']);
		// 读取解压后的文件并发送给主线程
		const jsArrayBuffer = js7z.FS.readFile('classes.js').buffer;
		const epkArrayBuffer = js7z.FS.readFile('assets.epk').buffer;
		self.postMessage({
			type: 'complete',
			data: {
				jsArrayBuffer: jsArrayBuffer,
				epkArrayBuffer: epkArrayBuffer
			}
		}, [jsArrayBuffer, epkArrayBuffer]); // 转移ArrayBuffer所有权
	} catch (err) {
		sendError(err);
		throw err;
	} finally {
		// 清理资源
		if (js7z && js7z.FS && js7z.FS.analyzePath(zName).exists) {
			try {
				js7z.FS.unlink(zName);
			} catch (e) {
				console.error('清理7z文件失败：', e);
			}
		}
	}
})();