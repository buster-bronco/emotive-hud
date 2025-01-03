# Emotive HUD

A FoundryVTT module that adds an expressive character portrait system, allowing players and GMs to quickly switch between different character portraits/expressions during gameplay.

## Features

- **Dynamic Portrait HUD**: Display character portraits in either a floating window or embedded in the chat sidebar
- **Expression Management**: Easily switch between different character expressions/portraits during gameplay
- **Multi-Actor Support**: Add multiple characters to the HUD for quick access
- **Flexible Layout**: Configure the grid layout with adjustable columns
- **Permission-Based**: GMs can configure actors while players can change expressions for owned characters
- **Chat Integration**: Use `/say` command to send messages with your character's current expression

## Usage

### For GMs

#### **Setting Up the HUD**
   - Click the menu icon (≡) in the Emotive HUD
   - Drag actor tokens into the configuration window
   - Select a folder containing portrait images for each actor
   - Click Apply to save changes

### For Players

#### **Changing Expressions**
   - Right-click on a character portrait in the HUD to open the expression picker
   - Click an expression to switch to it
   - Double-click a portrait to open the character sheet

#### **Chat Integration**
   - Use `/say [message]` to send a chat message with your current expression
   - Messages will include both your text and current portrait

### Basic Controls

- **Toggle HUD**: Click the chevron icon (▼/▲) to minimize/maximize the HUD
- **Reset Portrait**: Click "Reset to Default" in the expression picker to return to the default portrait

## Configuration

### Module Settings

- **Actor Limit**: Maximum number of actors that can be added to the HUD (default: 15)
- **Grid Columns**: Number of columns in the portrait grid (default: 3)
- **HUD Layout**: Choose between `Embedded in Chat` or `Floating Window`

### Portrait Requirements

- Supported image formats: JPG, JPEG, PNG, WEBP
- All portraits for a character should be in the same folder
- Consistent image dimensions recommended for best results

## Permissions

- **GM**: Full access to all features, including HUD configuration
- **Players**: Can change expressions for owned characters and use chat integration

## Technical Notes

- Portrait changes only affect the Emotive HUD display and `/say` messages - they do not modify the actor's default portrait in the character sheet
- The module uses WebSocket communication to sync portrait changes across clients
- Portrait selections persist between sessions
- Compatible with [Chat Commander](https://foundryvtt.com/packages/_chatcommands/)

## Acknowledgments
- Built for Foundry VTT (https://foundryvtt.com)

Used Code Snippets From
- https://github.com/MemelyPepeartly/pf2e-typescript-content-pack-template
- https://github.com/Lazrius/FoundryVTT-Typescript-Module-Template
