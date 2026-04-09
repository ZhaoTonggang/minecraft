"use strict";
importScripts('../7z/js7z.js');
// 定义数据块大小
const chunkSize = 1024 * 1024; // 1MB/块
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
// 辅助函数：格式化字节数（B/KB/MB/GB），提升进度显示友好度
const formatBytes = (bytes) => {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
// 原有的分段执行函数
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
// 分片下载核心函数
const downloadSlice = async (path, start, end, i, progressTracker) => {
	try {
		const response = await fetch(path, {
			headers: {
				'Range': `bytes=${start}-${end}` // 请求指定字节范围的分片
			}
		});
		if (!response.ok) throw new Error(`分片${i+1}下载失败：${response.status} ${response.statusText}`);
		const reader = response.body.getReader();
		let chunks = [];
		let sliceReceivedLength = 0;
		// 流式读取当前分片
		while (true) {
			const {
				done,
				value
			} = await reader.read();
			if (done) break;
			chunks.push(value);
			sliceReceivedLength += value.length;
			// 累加总已接收字节数，计算并发送总进度
			progressTracker.totalReceived += value.length;
			const progressPercent = Math.floor((progressTracker.totalReceived / progressTracker.totalSize) *
				100);
			sendStatus(
				`数据下载中... (${formatBytes(progressTracker.totalReceived)}/${formatBytes(progressTracker.totalSize)}) ${progressPercent}%`
			);
			await new Promise(resolve => setTimeout(resolve, 0));
		}
		// 合并当前分片数据
		const sliceBuffer = new Uint8Array(sliceReceivedLength);
		let position = 0;
		for (const chunk of chunks) {
			sliceBuffer.set(chunk, position);
			position += chunk.length;
		}
		return {
			i,
			buffer: sliceBuffer
		}
	} catch (err) {
		sendError(new Error(`分片${i+1}下载出错：${err.message}`));
		throw err;
	}
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
			const headResponse = await fetch(path, {
				method: 'HEAD'
			});
			if (!headResponse.ok) throw new Error(`获取文件信息失败：${headResponse.status} ${headResponse.statusText}`);
			// 检查是否支持分片下载
			const totalSize = Number(headResponse.headers.get('Content-Length')) || 0;
			if (totalSize) {
				// 计算分片信息
				const totalSlices = Math.ceil(totalSize / chunkSize);
				sendStatus(`文件总大小：${formatBytes(totalSize)}，将分为${totalSlices}个分片并行下载`);
				// 创建进度跟踪器
				const progressTracker = {
					totalReceived: 0, // 所有分片累计已下载字节数
					totalSize: totalSize // 文件总字节数
				}
				// 生成分片下载任务
				const sliceTasks = [];
				for (let i = 0; i < totalSlices; i++) {
					const start = i * chunkSize;
					// 最后一个分片的结束位置是文件总大小-1
					const end = Math.min(start + chunkSize - 1, totalSize - 1);
					sliceTasks.push(downloadSlice(path, start, end, i, progressTracker));
				}
				// 并行下载所有分片
				sendStatus(`开始并行下载${totalSlices}个分片...`);
				const sliceResults = await Promise.all(sliceTasks);
				// 按分片索引排序，确保顺序正确
				sliceResults.sort((a, b) => a.i - b.i);
				// 合并所有分片为完整文件
				sendStatus('所有分片下载完成，正在合并数据...');
				buffer = new Uint8Array(totalSize);
				let position = 0;
				await runInSlices(function*() {
					for (const slice of sliceResults) {
						buffer.set(slice.buffer, position);
						position += slice.buffer.length;
						// 合并时也显示合并进度
						const mergePercent = Math.floor((position / totalSize) * 100);
						sendStatus(
							`数据合并中... (${formatBytes(position)}/${formatBytes(totalSize)}) ${mergePercent}%`
						);
						yield;
					}
				});
			} else {
				sendStatus('服务器不支持分片下载，将使用单线程下载');
				// 回退到原有的单线程下载逻辑
				const response = await fetch(path);
				if (!response.ok) throw new Error(`下载失败：${response.status} ${response.statusText}`);
				const zdata = response.body.getReader();
				let chunks = [];
				let totalReceived = 0;
				while (true) {
					const {
						done,
						value
					} = await zdata.read();
					if (done) break;
					chunks.push(value);
					totalReceived += value.length;
					// 单线程下载也显示总进度
					const progressPercent = Math.floor((totalReceived / totalSize) * 100);
					sendStatus(
						`数据下载中... (${formatBytes(totalReceived)}/${formatBytes(totalSize)}) ${progressPercent}%`
					);
					await new Promise(resolve => setTimeout(resolve, 0));
				}
				buffer = new Uint8Array(totalReceived);
				let position = 0;
				for (const chunk of chunks) {
					buffer.set(chunk, position);
					position += chunk.length;
				}
			}
			// 写入缓存
			sendStatus("正在写入缓存");
			await cache.put(zName, new Response(buffer, {
				headers: {
					'Content-Type': 'application/x-7z-compressed',
					'Content-Length': totalSize
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
					const end = Math.min(position + chunkSize, blen);
					const chunk = buffer.subarray(position, end);
					js7z.FS.write(stream, chunk, 0, chunk.length);
					position = end;
					const writePercent = Math.floor((position / blen) * 100);
					sendStatus(
						`正在写入数据...(${formatBytes(position)}/${formatBytes(blen)}) ${writePercent}%`);
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
		// 发送给主线
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