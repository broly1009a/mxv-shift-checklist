import struct
import zlib
import numpy as np
import cv2
import os

def decode_paint_file(paint_path: str, out_jpg_path: str) -> bool:
    """
    Pure-Python parser & decoder for Windows 11 MS Paint (.paint) project files.
    Extracts the uncompressed image layer (unci) compressed with deflate (cmpC: defl).
    Zero external C-library dependency beyond standard zlib + cv2/numpy.
    """
    try:
        with open(paint_path, 'rb') as f:
            data = f.read()

        # Verify ftyp header
        if len(data) < 32 or data[4:8] != b'ftyp':
            return False

        # Find ispe (image spatial extents: width, height)
        ispe_idx = data.find(b'ispe')
        if ispe_idx == -1:
            return False
        # ispe box: 4 bytes size, 4 bytes 'ispe', 4 bytes version+flags, 4 bytes width, 4 bytes height
        width, height = struct.unpack('>II', data[ispe_idx + 8 : ispe_idx + 16])

        # Find iloc (item location) to get offset and length of image data
        iloc_idx = data.find(b'iloc')
        extent_offset = None
        extent_len = None

        if iloc_idx != -1:
            # iloc box header: size (4), 'iloc' (4), version+flags (4)
            # offset_size (4 bits), length_size (4 bits), base_offset_size (4 bits), index_size (4 bits)
            ver_flags = struct.unpack('>I', data[iloc_idx + 4 : iloc_idx + 8])[0]
            version = ver_flags >> 24
            size_bytes = data[iloc_idx + 8 : iloc_idx + 10]
            offset_size = (size_bytes[0] >> 4) & 0x0F
            length_size = size_bytes[0] & 0x0F
            base_offset_size = (size_bytes[1] >> 4) & 0x0F
            index_size = size_bytes[1] & 0x0F if version >= 1 else 0

            # Let's inspect item count
            item_count_offset = iloc_idx + 10
            if version < 2:
                item_count = struct.unpack('>H', data[item_count_offset : item_count_offset + 2])[0]
                curr = item_count_offset + 2
            else:
                item_count = struct.unpack('>I', data[item_count_offset : item_count_offset + 4])[0]
                curr = item_count_offset + 4

            # Parse each item until item_ID == 1
            for _ in range(item_count):
                if version < 2:
                    item_id = struct.unpack('>H', data[curr : curr + 2])[0]
                    curr += 2
                else:
                    item_id = struct.unpack('>I', data[curr : curr + 4])[0]
                    curr += 4

                if version in (1, 2):
                    curr += 2 # construction_method
                curr += 2 # data_reference_index

                # base_offset
                if base_offset_size == 4:
                    base_offset = struct.unpack('>I', data[curr : curr + 4])[0]
                    curr += 4
                elif base_offset_size == 8:
                    base_offset = struct.unpack('>Q', data[curr : curr + 8])[0]
                    curr += 8
                else:
                    base_offset = 0

                # extent count
                extent_count = struct.unpack('>H', data[curr : curr + 2])[0]
                curr += 2

                for _e in range(extent_count):
                    if (version in (1, 2)) and index_size > 0:
                        curr += index_size
                    # extent offset
                    if offset_size == 4:
                        e_offset = struct.unpack('>I', data[curr : curr + 4])[0]
                        curr += 4
                    elif offset_size == 8:
                        e_offset = struct.unpack('>Q', data[curr : curr + 8])[0]
                        curr += 8
                    else:
                        e_offset = 0

                    # extent length
                    if length_size == 4:
                        e_len = struct.unpack('>I', data[curr : curr + 4])[0]
                        curr += 4
                    elif length_size == 8:
                        e_len = struct.unpack('>Q', data[curr : curr + 8])[0]
                        curr += 8
                    else:
                        e_len = 0

                    if item_id == 1 and e_len > 0:
                        extent_offset = base_offset + e_offset
                        extent_len = e_len
                        break
                if extent_offset is not None:
                    break

        # Fallback if iloc parsing failed: look for mdat
        if extent_offset is None or extent_len is None:
            mdat_idx = data.find(b'mdat')
            if mdat_idx != -1:
                mdat_size = struct.unpack('>I', data[mdat_idx - 4 : mdat_idx])[0]
                extent_offset = mdat_idx + 4
                extent_len = mdat_size - 8

        if extent_offset is None or extent_len is None:
            return False

        compressed = data[extent_offset : extent_offset + extent_len]
        # Decompress with raw deflate
        decompressed = zlib.decompress(compressed, -zlib.MAX_WBITS)

        # Expected size: width * height * 4 (BGRA)
        expected_len = width * height * 4
        if len(decompressed) < expected_len:
            # Try 3 channels (BGR)
            if len(decompressed) >= width * height * 3:
                arr = np.frombuffer(decompressed[: width * height * 3], dtype=np.uint8).reshape((height, width, 3))
            else:
                return False
        else:
            arr_bgra = np.frombuffer(decompressed[:expected_len], dtype=np.uint8).reshape((height, width, 4))
            arr = cv2.cvtColor(arr_bgra, cv2.COLOR_BGRA2BGR)

        os.makedirs(os.path.dirname(os.path.abspath(out_jpg_path)), exist_ok=True)
        cv2.imwrite(out_jpg_path, arr, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        return True
    except Exception as e:
        print(f"Lỗi decode .paint file: {e}")
        return False


if __name__ == '__main__':
    src = r'M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Mo TKGD\HoSo_DinhKem\2026-09-16\001C6332468\CCCD Dương Hoàng Hải.paint'
    dst = r'C:\Users\hiepth\.gemini\antigravity-ide\brain\bec17626-a0e5-4d71-a552-7005f70a217d\paint_test_decoded.jpg'
    ok = decode_paint_file(src, dst)
    print("Decode result:", ok)
    if ok:
        im = cv2.imread(dst)
        print("Decoded image shape:", im.shape)
