import AppKit
let size = NSSize(width: 1024, height: 1024)
let image = NSImage(size: size)
image.lockFocus()
NSColor(red: 0.965, green: 0.953, blue: 0.902, alpha: 1).setFill()
NSBezierPath(rect: NSRect(origin: .zero, size: size)).fill()
NSColor(red: 0.1, green: 0.19, blue: 0.75, alpha: 0.12).setStroke()
for y in stride(from: 110, to: 1024, by: 95) {
    let line = NSBezierPath(); line.lineWidth = 3; line.move(to: NSPoint(x: 0, y: y)); line.line(to: NSPoint(x: 1024, y: y)); line.stroke()
}
let icon = NSImage(systemSymbolName: "scope", accessibilityDescription: nil)!.withSymbolConfiguration(.init(pointSize: 550, weight: .medium))!
icon.isTemplate = false
let tinted = NSImage(size: icon.size)
tinted.lockFocus()
icon.draw(at: .zero, from: .zero, operation: .sourceOver, fraction: 1)
NSColor(red: 0.10, green: 0.19, blue: 0.75, alpha: 1).setFill()
NSRect(origin: .zero, size: icon.size).fill(using: .sourceAtop)
tinted.unlockFocus()
tinted.draw(in: NSRect(x: 220, y: 220, width: 584, height: 584))
NSColor(red: 0.82, green: 0.12, blue: 0.19, alpha: 1).setFill()
NSBezierPath(ovalIn: NSRect(x: 478, y: 478, width: 68, height: 68)).fill()
image.unlockFocus()
let bitmap = NSBitmapImageRep(data: image.tiffRepresentation!)!
try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
