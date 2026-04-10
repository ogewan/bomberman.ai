from __future__ import annotations

import asyncio
import contextlib
import json
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Optional

import websockets

from .protocol import TrainingObservation, TrainingStepResult


JsonDict = Dict[str, Any]


def _next_request_id() -> str:
    return f"py_req_{uuid.uuid4().hex}"


@dataclass(slots=True)
class RemoteInstanceHandle:
    client: "EnvironmentSocketClient"
    instance_id: str

    async def init(self, config: JsonDict) -> JsonDict:
        return await self.client.command(self.instance_id, {"kind": "init", "config": config})

    async def reset(self) -> TrainingObservation:
        payload = await self.client.command(self.instance_id, {"kind": "reset"})
        return TrainingObservation.from_dict(payload["observation"])

    async def step(self, action: Any) -> TrainingStepResult:
        payload = await self.client.command(self.instance_id, {"kind": "step", "action": action})
        return TrainingStepResult.from_dict(payload["result"])

    async def save_state(self) -> JsonDict:
        payload = await self.client.command(self.instance_id, {"kind": "saveState"})
        return dict(payload["snapshot"])

    async def load_state(self, snapshot: JsonDict) -> None:
        await self.client.command(self.instance_id, {"kind": "loadState", "snapshot": snapshot})

    async def get_action_space(self) -> JsonDict:
        payload = await self.client.command(self.instance_id, {"kind": "getActionSpace"})
        return dict(payload["actionSpace"])

    async def get_info(self) -> JsonDict:
        payload = await self.client.command(self.instance_id, {"kind": "getInfo"})
        return dict(payload["info"])

    async def dispose(self) -> None:
        await self.client.command(self.instance_id, {"kind": "dispose"})

    async def destroy(self) -> None:
        await self.client.destroy_instance(self.instance_id)


class EnvironmentSocketClient:
    def __init__(self, url: str) -> None:
        self.url = url
        self._socket: Optional[websockets.WebSocketClientProtocol] = None
        self._pending: Dict[str, asyncio.Future[JsonDict]] = {}
        self._reader_task: Optional[asyncio.Task[None]] = None

    async def connect(self) -> None:
        self._socket = await websockets.connect(self.url)
        self._reader_task = asyncio.create_task(self._reader_loop())

    async def close(self) -> None:
        if self._reader_task:
            self._reader_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._reader_task
            self._reader_task = None
        if self._socket:
            await self._socket.close()
            self._socket = None

    async def create_instance(self, instance_id: Optional[str] = None) -> RemoteInstanceHandle:
        request: JsonDict = {"kind": "createInstance", "requestId": _next_request_id()}
        if instance_id is not None:
            request["instanceId"] = instance_id
        response = await self._request(request)
        return RemoteInstanceHandle(client=self, instance_id=str(response["instanceId"]))

    async def destroy_instance(self, instance_id: str) -> None:
        await self._request({
            "kind": "destroyInstance",
            "requestId": _next_request_id(),
            "instanceId": instance_id,
        })

    async def list_instances(self) -> list[str]:
        response = await self._request({
            "kind": "listInstances",
            "requestId": _next_request_id(),
        })
        return list(response["instanceIds"])

    async def command(self, instance_id: str, command: JsonDict) -> JsonDict:
        response = await self._request({
            "kind": "command",
            "requestId": _next_request_id(),
            "instanceId": instance_id,
            "command": command,
        })
        return dict(response["result"])

    async def _request(self, payload: JsonDict) -> JsonDict:
        if self._socket is None:
            raise RuntimeError("EnvironmentSocketClient is not connected.")

        future: asyncio.Future[JsonDict] = asyncio.get_running_loop().create_future()
        request_id = str(payload["requestId"])
        self._pending[request_id] = future
        await self._socket.send(json.dumps(payload))
        return await future

    async def _reader_loop(self) -> None:
        assert self._socket is not None

        async for message in self._socket:
            payload = json.loads(message)
            request_id = str(payload["requestId"])
            future = self._pending.pop(request_id, None)
            if future is None:
                continue

            if payload["kind"] == "error":
                future.set_exception(RuntimeError(str(payload["message"])))
            else:
                future.set_result(payload)
