"""
ระบบพิมพ์ฉลากสินค้าด้วย ZPL (Zebra Programming Language)
สามารถพิมพ์ข้อมูลสินค้า, QR Code และรูปภาพลงบนฉลาก
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import win32print
import base64
from io import BytesIO
from PIL import Image, ImageEnhance

app = Flask(__name__)
CORS(app)

# ======= ตัวแปรระดับโปรแกรม =======
PRINT_COUNTER = 0  # ตัวนับจำนวนการพิมพ์
DEFAULT_PRINTER = "Honeywell PC42t plus (203 dpi) (Copy 1)"
MAX_IMAGE_SIZE = (180, 180)  # ขนาดสูงสุดของรูปภาพ (กว้าง, สูง)

# ======= ฟังก์ชันจัดการรูปภาพ =======
def convert_base64_to_zpl_image(image_base64):
    """แปลงรูปภาพ Base64 เป็นรูปแบบ ZPL
    
    Args:
        image_base64 (str): รูปภาพในรูปแบบ Base64
        
    Returns:
        str: คำสั่ง ZPL สำหรับแสดงรูปภาพ หรือ None ถ้าเกิดข้อผิดพลาด
    """
    try:
        # ลบ prefix ของ data URL ถ้ามี
        if image_base64.startswith("data:image"):
            image_base64 = image_base64.split(",")[1]
        
        # แปลงรูปภาพและปรับแต่ง
        image_data = base64.b64decode(image_base64)
        image = Image.open(BytesIO(image_data))
        image = image.convert("L")  # แปลงเป็นภาพขาวดำ
        
        # เพิ่มความคมชัด
        contrast = ImageEnhance.Contrast(image)
        image = contrast.enhance(2)
        image = image.convert("1")  # แปลงเป็นภาพแบบ 1 bit
        
        # ปรับขนาดรูปภาพ
        image.thumbnail(MAX_IMAGE_SIZE, Image.LANCZOS)
        
        # แปลงเป็นรูปแบบ ZPL
        width, height = image.size
        bytes_per_row = (width + 7) // 8
        total_bytes = bytes_per_row * height
        
        # แปลงข้อมูลรูปภาพเป็น bytes
        zpl_image_data = bytearray()
        for y in range(height):
            byte = 0
            bit_count = 0
            for x in range(width):
                if image.getpixel((x, y)) == 0:  # พิกเซลสีดำ
                    byte |= (1 << (7 - bit_count))
                bit_count += 1
                if bit_count == 8:
                    zpl_image_data.append(byte)
                    byte = 0
                    bit_count = 0
            if bit_count > 0:
                zpl_image_data.append(byte)
        
        # แปลงเป็น hex string
        hex_data = ''.join(f"{b:02X}" for b in zpl_image_data)
        return f"^GFA,{total_bytes},{total_bytes},{bytes_per_row},{hex_data}\n"
        
    except Exception as e:
        print(f"เกิดข้อผิดพลาดในการแปลงรูปภาพ: {e}")
        return None

# ======= ฟังก์ชันสร้างฉลาก =======
def format_part_name(part_name):
    """จัดรูปแบบชื่อชิ้นส่วนให้แสดงผลบนฉลากได้เหมาะสม
    
    Args:
        part_name (str): ชื่อชิ้นส่วน
        
    Returns:
        list: รายการบรรทัดที่จัดรูปแบบแล้ว
    """
    if not part_name:
        return []
        
    words = part_name.split()
    lines = []
    current_line = ""
    space_count = 0
    
    for word in words:
        # ข้ามช่องว่างที่ 2 และ 3
        if space_count in [1, 2]:
            current_line += word + " "
        else:
            # ตรวจสอบความยาวบรรทัด
            if len(current_line + word) <= 10:
                current_line += word + " "
            else:
                lines.append(current_line.strip())
                current_line = word + " "
        space_count += 1
        
    if current_line:
        lines.append(current_line.strip())
    return lines

def generate_zpl_label(form_data, serial_number, counter, image_data=None):
    """สร้างคำสั่ง ZPL สำหรับพิมพ์ฉลาก"""
    part_name_lines = format_part_name(form_data['partName'])
    part_name_zpl = ""
    for i, line in enumerate(part_name_lines):
        y_position = 320 + (i * 45)
        part_name_zpl += f"^FO200,{y_position}^A0N,30,30^FD{line}^FS\n"
    
    material = form_data['mat'][:14] + "..." if len(form_data.get('mat', '')) > 14 else form_data.get('mat', '')
    
    zpl = f"""
^XA
^PW818 
^LL1080

^FO30,30^GFA,1080,1080,12,,O01C1E,O07E1F8,O0FE3FC,N03FF3FF,N07FF3FF8,M01IF3FFE,M03IF3IF,M0JF3IFC,L01JF3IFE,L07JF3JF8,L0KF3JFC,K03KF3KF,K07KF3KF8,J01LF3KFE,J03LF3LF,J0MF3LFC,I01MF3LFE,I07MF3MF,I0NF3MFC,003NF3MFE,007NF3NF8,01OF3NFC,03OF3OF,07OF3OF,:03OF3OF,03OF3NFE,00OF3NFC,007NF3NF,001NF3MFE,060NF3MF838,0F83MF3MF07C,1FC1MF3LFC1FE,1FF07LF3LF87FE,1FF83LF3KFE0FFE,1FFE0LF3KFC3FFE,1IF07KF3KF07FFE,1IFC1KF3JFE1IFE,1IFE0KF3JF83IFE,1JF83JF3JF0JFE,1JFC1JF3IFC1JFE,1KF07IF3IF87JFE,1KF83IF3FFE0KFE,1KFE0IF3FFC3KFE,1LF07FF3FF07KFE,1LFC1FF3FE1LFC,0LFE0FE3F83LFC,07LF83E1F0MF,01LFC1C0C1LFE,00MFJ07LF8,003LF8I0MF,061LFE003LFC1,0F07LF007LF87C,1FC3LFC1LFE0FE,1FE0LFE1LFC3FE,1FF87KFE3LF07FE,1FFC1LF3KFE1FFE,1IF0LF3KF83FFE,1IF83KF3KF0IFE,1IFE1KF3JFC1IFE,1JF07JF3JF87IFE,1JFC3JF3IFE0JFE,1JFE0JF3IFC3JFC,0KF87IF3IF07JFC,07JFC1IF3FFE1KF,01KF0IF3FF83JFE,00KFC3FF3FF0KF8,003JFE1FF3FC1KF,001KF87E3F87JFC,I07JFC3E1E0KF8,I03KFJ03JFE,J0KF8I07JFC,J07JFE001KF,J01KF003JFE,K0KFC0KF8,K03JFE1KF,K01JFE3JFC,L07JF3JF8,L03JF3IFE,M0JF3IFC,M07IF3IF,M01IF3FFE,N0IF3FF8,N03FF3FF,N01FF3FC,O07E3F8,O03E1E,,:^FS

^FO130,34^GB5,76,5^FS
^FO150,40^A0N,50,50^FDMES B8^FS
^FO150,95^A0N,25,25^FDManufacturing Execution System B8^FS

^FO30,140^GB760,2,2^FS
^FO30,140^GB2,90,2^FS
^FO430,140^GB2,90,2^FS
^FO790,140^GB2,90,2^FS

^FO40,160^A0N,25,25^FDCustomer Name : {form_data['customerName']}^FS
^FO450,160^A0N,25,25^FDModel : {form_data['model']}^FS

^FO30,190^GB760,2,2^FS

^FO40,202^A0N,25,25^FDSupplier : ^FS
^FO150,202^A0N,25,25^FD{form_data['supplier']}^FS
^FO450,202^A0N,25,25^FDJob No :^FS
^FO550,202^A0N,25,25^FD{form_data['jobOrder']}^FS

^FO30,230^GB760,2,2^FS

{part_name_zpl}

^FO440,370^A0N,25,25^FDProducer :^FS
^FO560,370^A0N,25,25^FD{form_data['producer']} ^FS

^FO440,430^A0N,25,25^FDDate :^FS
^FO560,430^A0N,25,25^FD{form_data['date']} ^FS

^FO30,390^A0N,25,25^FDPicture of Part :^FS
^FO120,420^BQN,2,7^FDQA,{form_data['matNo']}|{serial_number}^FS

^FO440,490^A0N,25,25^FDQuantity (Unit) :^FS
^FO500,590^A0N,100,100^FD{form_data['quantityStd']}^FS

"""

    if image_data:
        zpl += f"^FO20,520\n{image_data}^FS\n"
    
    zpl += "^XZ"
    return zpl

# ======= ฟังก์ชันพิมพ์ =======
def print_zpl(zpl_data, printer_name=DEFAULT_PRINTER):
    """ส่งคำสั่ง ZPL ไปยังเครื่องพิมพ์
    
    Args:
        zpl_data (str): คำสั่ง ZPL
        printer_name (str): ชื่อเครื่องพิมพ์
    """
    try:
        printer = win32print.OpenPrinter(printer_name)
        job = win32print.StartDocPrinter(printer, 1, ("ZPL Label", None, "RAW"))
        win32print.StartPagePrinter(printer)
        win32print.WritePrinter(printer, zpl_data.encode('utf-8'))
        win32print.EndPagePrinter(printer)
        win32print.EndDocPrinter(printer)
        print(f"เริ่มพิมพ์ที่ {printer_name}")
    except Exception as e:
        print(f"เกิดข้อผิดพลาดในการพิมพ์: {e}")
    finally:
        if 'printer' in locals():
            win32print.ClosePrinter(printer)

# ======= Flask Route =======
@app.route('/printtest', methods=['POST'])
def print_label():
    """endpoint สำหรับรับคำสั่งพิมพ์ฉลาก"""
    global PRINT_COUNTER
    
    # ตรวจสอบข้อมูลที่ส่งมา
    data = request.json
    print("ได้รับข้อมูล POST:", data)
    
    if not data or not all(key in data for key in ['form_data', 'serial_number', 'state']):
        return jsonify({"error": "ข้อมูลไม่ครบถ้วน ต้องมี 'form_data', 'serial_number', และ 'state'"}), 400
        
    if data['state'] != "1":
        return jsonify({"error": "สถานะไม่ถูกต้องสำหรับการพิมพ์"}), 400
    
    # แปลงรูปภาพถ้ามี
    image_base64 = data.get('image')
    zpl_image = convert_base64_to_zpl_image(image_base64) if image_base64 else None
    
    # สร้างและพิมพ์ฉลาก
    zpl_data = generate_zpl_label(data['form_data'], data['serial_number'], PRINT_COUNTER, zpl_image)
    print_zpl(zpl_data)
    
    # อัพเดทตัวนับ
    PRINT_COUNTER = 1 if PRINT_COUNTER >= 100 else PRINT_COUNTER + 1
    
    return jsonify({
        "message": "ส่งงานพิมพ์เรียบร้อยแล้ว",
        "current_counter": PRINT_COUNTER
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)