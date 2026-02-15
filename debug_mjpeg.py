import urllib.request

try:
    print("Connecting...")
    with urllib.request.urlopen("http://localhost:9876/stream.mjpeg", timeout=2) as response:
        print(f"Status: {response.status}")
        print("Headers:", response.getheaders())
        print("First 200 bytes:", response.read(200))
except Exception as e:
    print(f"Error: {e}")
