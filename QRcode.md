1. How the QR codes will work with your app
You don't necessarily need to put the QR code images directly into your app's code.

Instead, your app needs to recognize the information stored inside each QR code.

For example:
QR code is scanned

Contains: CG-ROOM-205A

Campus Ghost reads the ID

Looks up the matching location

Room 205A appears

Group Study Room • Second Floor


Your code could contain something like:
const locations = {
  "CG-ROOM-205A": {
    name: "Group Study Room 205A",
    floor: 2,
    type: "Group Study",
  },

  "CG-PRINTER-01": {
    name: "Printer 1",
    floor: 2,
    type: "Printer",
  },
};
