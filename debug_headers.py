import urllib.request

def test_url(url, distinct_name):
    print(f"\n--- Testing {distinct_name} ({url}) ---")
    try:
        with urllib.request.urlopen(url, timeout=3) as response:
            print(f"Status: {response.status}")
            print("Headers:")
            for k, v in response.getheaders():
                print(f"  {k}: {v}")
            
            data = response.read(100)
            print(f"First 100 bytes: {data}")
    except Exception as e:
        print(f"Error: {e}")

test_url("http://localhost:9876/screen.jpg", "Static JPEG")
test_url("http://localhost:9876/stream.mjpeg", "MJPEG Stream")
