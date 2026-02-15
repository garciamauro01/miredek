import urllib.request
import time

def test_stream_multi_frame(url, num_frames=5):
    print(f"\n--- Testing Multiple Frames for {url} ---")
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as response:
            print(f"Status: {response.status}")
            print(f"Response Headers: {dict(response.getheaders())}")
            
            for i in range(num_frames):
                print(f"\n[Frame {i+1}] Reading part header...")
                # Read until blank line (end of part header)
                header_found = False
                header_data = b""
                while not header_found:
                    line = response.readline()
                    if not line: break
                    header_data += line
                    if line == b"\r\n":
                        header_found = True
                
                print(f"Header: {header_data.decode('ascii', errors='ignore').strip()}")
                
                # Try to extract Content-Length
                length = 0
                for h_line in header_data.decode('ascii', errors='ignore').split("\r\n"):
                    if "Content-Length:" in h_line:
                        length = int(h_line.split(":")[1].strip())
                
                if length > 0:
                    print(f"Reading {length} bytes of image data...")
                    image_data = response.read(length)
                    print(f"Read {len(image_data)} bytes.")
                    # Read the trailing CRLF
                    trailing = response.read(2)
                    print(f"Trailing bytes (expected \\r\\n): {trailing}")
                else:
                    print("No Content-Length found, reading up to next boundary...")
                    # This is more complex, but for now we expect Content-Length
                    break
                    
                time.sleep(0.1)
                
            print("\nSuccessfully read all requested frames!")
            
    except Exception as e:
        print(f"\nError during stream test: {e}")

test_stream_multi_frame("http://localhost:9876/stream.mjpeg")
