// Mechanical platform layout: keep the approved artwork intact, but use the
// standard legacy macOS 832pt artwork / 1024pt canvas to avoid double framing.
import AppKit
let args = CommandLine.arguments
let input = args[1], output = args[2]
guard let image = NSImage(contentsOfFile: input) else { fatalError("Cannot read icon") }
let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 1024, pixelsHigh: 1024, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
bitmap.bitmapData!.initialize(repeating: 0, count: bitmap.bytesPerRow * 1024)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
NSGraphicsContext.current!.imageInterpolation = .high
// Measure alpha bounds first: preserve the new artwork's antialiasing safety
// margin without accumulating a second platform padding around that margin.
image.draw(in: NSRect(x:0,y:0,width:1024,height:1024), from: .zero, operation: .copy, fraction: 1)
var left=1024, top=1024, right = -1, bottom = -1
for y in 0..<1024 { for x in 0..<1024 { if bitmap.bitmapData![y * bitmap.bytesPerRow + x * 4 + 3] > 0 { left=min(left,x); top=min(top,y); right=max(right,x); bottom=max(bottom,y) } } }
left=max(0,left-2); top=max(0,top-2); right=min(1023,right+2); bottom=min(1023,bottom+2)
bitmap.bitmapData!.initialize(repeating: 0, count: bitmap.bytesPerRow * 1024)
let crop=NSRect(x:Double(left)*image.size.width/1024, y:Double(1023-bottom)*image.size.height/1024, width:Double(right-left+1)*image.size.width/1024, height:Double(bottom-top+1)*image.size.height/1024)
image.draw(in: NSRect(x:96,y:96,width:832,height:832), from: crop, operation: .copy, fraction: 1)
NSGraphicsContext.restoreGraphicsState()
try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: output))
var minX = 1024, minY = 1024, maxX = -1, maxY = -1
for y in 0..<1024 { for x in 0..<1024 {
    if bitmap.bitmapData![y * bitmap.bytesPerRow + x * 4 + 3] > 8 {
        minX = min(minX, x); minY = min(minY, y); maxX = max(maxX, x); maxY = max(maxY, y)
    }
} }
print("\(output): visible bounds \(minX),\(minY)–\(maxX),\(maxY)")
