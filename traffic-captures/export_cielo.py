"""
Mitmproxy addon to export Cielo API traffic to JSON
Usage: mitmdump -r cielo-traffic.mitm -s export_cielo.py --quiet
"""
import json
import sys
from mitmproxy import http, websocket

class CieloExporter:
    def __init__(self):
        self.flows = []
        self.ws_messages = []

    def request(self, flow: http.HTTPFlow) -> None:
        """Process HTTP requests"""
        if 'smartcielo.com' not in flow.request.pretty_host:
            return

        flow_data = {
            'timestamp': flow.timestamp_start,
            'method': flow.request.method,
            'url': flow.request.pretty_url,
            'host': flow.request.pretty_host,
            'path': flow.request.path,
            'headers': dict(flow.request.headers),
        }

        # Add request body if present
        if flow.request.content:
            try:
                body = flow.request.content.decode('utf-8')
                flow_data['request_body'] = body
                try:
                    flow_data['request_json'] = json.loads(body)
                except:
                    pass
            except:
                flow_data['request_body'] = '<binary>'

        self.flows.append(flow_data)

    def response(self, flow: http.HTTPFlow) -> None:
        """Process HTTP responses"""
        if 'smartcielo.com' not in flow.request.pretty_host:
            return

        # Find the matching request flow_data
        for i, f in enumerate(self.flows):
            if f.get('url') == flow.request.pretty_url and not f.get('response'):
                self.flows[i]['response'] = {
                    'status_code': flow.response.status_code,
                    'headers': dict(flow.response.headers),
                }

                if flow.response.content:
                    try:
                        body = flow.response.content.decode('utf-8')
                        self.flows[i]['response']['body'] = body
                        try:
                            self.flows[i]['response']['json'] = json.loads(body)
                        except:
                            pass
                    except:
                        self.flows[i]['response']['body'] = '<binary>'
                break

    def websocket_message(self, flow: http.HTTPFlow) -> None:
        """Process WebSocket messages"""
        if not hasattr(flow, 'websocket') or not flow.websocket:
            return

        if 'smartcielo.com' not in flow.request.pretty_host:
            return

        for msg in flow.websocket.messages:
            msg_data = {
                'from_client': msg.from_client,
                'timestamp': msg.timestamp,
                'type': msg.type.name,
            }
            try:
                content = msg.content.decode('utf-8')
                msg_data['content'] = content
                try:
                    msg_data['json'] = json.loads(content)
                except:
                    pass
            except:
                msg_data['content'] = '<binary>'

            self.ws_messages.append(msg_data)

    def done(self):
        """Called when mitmproxy is shutting down"""
        output = {
            'http_flows': self.flows,
            'websocket_messages': self.ws_messages
        }

        with open('cielo-traffic-export.json', 'w') as f:
            json.dump(output, f, indent=2)

        print(f"\n✓ Exported {len(self.flows)} HTTP flows", file=sys.stderr)
        print(f"✓ Exported {len(self.ws_messages)} WebSocket messages", file=sys.stderr)
        print(f"✓ Results written to: cielo-traffic-export.json\n", file=sys.stderr)

        # Print summary
        endpoints = set()
        for flow in self.flows:
            path = flow['path'].split('?')[0]
            endpoint = f"{flow['method']} {path}"
            endpoints.add(endpoint)

        print("API Endpoints found:", file=sys.stderr)
        for endpoint in sorted(endpoints):
            print(f"  - {endpoint}", file=sys.stderr)

addons = [CieloExporter()]
