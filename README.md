# Emotive HUD

**Emotive HUD** is a [Foundry VTT](https://foundryvtt.com) module that brings characters to life with a dynamic portrait interface. This module lets players express their characters' emotions and reactions in real-time.

## v13 Update
- Now working on v13 version upgrade.

## Features

### Dynamic Portrait HUD

https://github.com/user-attachments/assets/85f6f8a5-a154-4cfd-bc25-57e04aa2033c

- **Right-click on a character portrait in the HUD to open the expression picker**
- Effortlessly switch between character portraits during gameplay for seamless interaction

### Chat Integration

https://github.com/user-attachments/assets/b707a901-11ac-4360-ac1f-1aae7ddff893

- Use `/say` to speak in character with your current portrait
- Use `/do` to describe actions with your current portrait
- Compatible with [Chat Commander](https://foundryvtt.com/packages/_chatcommands/)

### Flexible Layout

- Each player can customize their view with adjustable grid columns and portrait width settings
- Players may also embed the HUD at the top of the chat window
- Minimizable interface
- DMs can set the portrait aspect ratio for the portraits used in game

## Configuration

### Portrait Requirements

- Supported image formats: `JPG`, `JPEG`, `PNG`, `WEBP`, `GIF`
- All portraits for a character should be in the same folder
- Consistent image dimensions are recommended for best results

### Setting Up the HUD

1. Select Emotive HUD Actors

   - Click the menu icon (≡) in the Emotive HUD
   - Drag an actor from the 'Actors' tab into the configuration window
   - Arrange actors in the desired order using the drag handles

2. Adding Character Portraits:

   **Option 1: Upload Directly**
   - Click the upload icon next to an actor to upload files directly
   - If no folder is specified, images will be automatically organized into `/emotive-hud-portraits/[actor-name]/`
   - Existing files with the same names will be replaced

   **Option 2: Select Existing Folder**
   - Click the folder icon next to an actor
   - Navigate to and select a folder containing portrait images

3. Click `Apply` to save changes

   - The HUD will update to show the selected actors with their portraits and cache them for player use.

### Basic Controls

- **Toggle HUD**: Click the chevron icon (▼/▲) to minimize/maximize the HUD
- **Emotive Portrait Picker**: Right-click on a portrait for a character you own to set their portrait
- **Reset Portrait**: Click "Reset to Default" in the expression picker to return to the default portrait

### Module Settings
- **Actor Limit (World)**: Maximum number of actors that can be added to the HUD (default: 15)
- **Grid Columns (Local)**: Number of columns in the portrait grid (default: 3)
- **HUD Layout (Local)**: Choose between `Embedded in Chat` or `Floating Window`
- **Portrait Height Ratio (World)**: Controls the height-to-width ratio of actor portraits. A ratio of 1 creates square portraits, while 2 makes portraits twice as tall as they are wide.

## Permissions

- **GM**: Full access to all features, including HUD configuration
- **Players**: Can change expressions for owned characters and use chat integration

## Technical Notes

- Portrait changes only affect the display within the Emotive HUD and `/say` and `/do` messages. They do not modify the actor's default portrait in the character sheet.
- This module uses WebSocket communication to synchronize portrait changes across clients in real-time

## Development Setup

Install FoundryVTT locally, then create an `.env` file in the project root directory with your desired Foundry module path like this:

`FOUNDRY_VTT_PATH="path/to/your/foundry/data/modules/emotive-hud"`

This will allow you to use `npm run dev` to have a hot reloading development environment

## Acknowledgments
Used Code Snippets From
- https://github.com/MemelyPepeartly/pf2e-typescript-content-pack-template
- https://github.com/Lazrius/FoundryVTT-Typescript-Module-Template
