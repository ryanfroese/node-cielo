#!/usr/bin/env python3
"""
Analyzes the mitmproxy capture file and exports Cielo API traffic to JSON
"""
import json
import sys
from mitmproxy import io
from mitmproxy.exceptions import FlowReadException

def analyze_capture(filename):
    """Read and analyze the mitmproxy capture file"""

    cielo_flows = []

    try:
        with open(filename, "rb") as logfile:
            freader = io.FlowReader(logfile)
            try:
                for flow in freader.stream():
                    # Only process flows to/from smartcielo.com
                    if hasattr(flow, 'request') and flow.request and \
                       'smartcielo.com' in flow.request.pretty_host:

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
                                flow_data['request_body'] = flow.request.content.decode('utf-8')
                                # Try to parse as JSON
                                try:
                                    flow_data['request_json'] = json.loads(flow_data['request_body'])
                                except:
                                    pass
                            except:
                                flow_data['request_body'] = '<binary data>'

                        # Add response data if present
                        if flow.response:
                            flow_data['response'] = {
                                'status_code': flow.response.status_code,
                                'headers': dict(flow.response.headers),
                            }

                            if flow.response.content:
                                try:
                                    response_text = flow.response.content.decode('utf-8')
                                    flow_data['response']['body'] = response_text
                                    # Try to parse as JSON
                                    try:
                                        flow_data['response']['json'] = json.loads(response_text)
                                    except:
                                        pass
                                except:
                                    flow_data['response']['body'] = '<binary data>'

                        # Add WebSocket messages if present
                        if hasattr(flow, 'websocket') and flow.websocket:
                            flow_data['websocket_messages'] = []
                            for msg in flow.websocket.messages:
                                msg_data = {
                                    'from_client': msg.from_client,
                                    'timestamp': msg.timestamp,
                                }
                                try:
                                    content = msg.content.decode('utf-8')
                                    msg_data['content'] = content
                                    try:
                                        msg_data['json'] = json.loads(content)
                                    except:
                                        pass
                                except:
                                    msg_data['content'] = '<binary data>'
                                flow_data['websocket_messages'].append(msg_data)

                        cielo_flows.append(flow_data)

            except FlowReadException as e:
                print(f"Warning: Error reading some flows: {e}", file=sys.stderr)
                print("This is normal if mitmdump is still writing to the file", file=sys.stderr)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return None

    return cielo_flows

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 analyze-capture.py <capture-file.mitm>")
        sys.exit(1)

    flows = analyze_capture(sys.argv[1])

    if flows:
        # Write to JSON file
        output_file = sys.argv[1].replace('.mitm', '-analysis.json')
        with open(output_file, 'w') as f:
            json.dump(flows, f, indent=2)

        print(f"Analyzed {len(flows)} Cielo API flows")
        print(f"Results written to: {output_file}")

        # Print summary
        print("\nAPI Endpoints found:")
        endpoints = set()
        for flow in flows:
            endpoint = f"{flow['method']} {flow['path'].split('?')[0]}"
            endpoints.add(endpoint)
        for endpoint in sorted(endpoints):
            print(f"  - {endpoint}")

        # Print WebSocket message count
        ws_count = sum(len(f.get('websocket_messages', [])) for f in flows)
        print(f"\nWebSocket messages: {ws_count}")
    else:
        print("No flows found")
        sys.exit(1)
