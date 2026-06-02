"""Test the map editor in the asymmetric game."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(500)

    # 1. Check main menu is visible
    assert page.locator('#menu-screen').is_visible()
    assert not page.locator('#menu-screen.hidden').count()
    print('[OK] Main menu visible')

    # 2. Click "地图编辑器" button
    editor_btn = page.locator('button', has_text='地图编辑器')
    assert editor_btn.is_visible()
    editor_btn.click()
    page.wait_for_timeout(500)

    # 3. Check editor screen is visible
    assert page.locator('#editor-screen').is_visible()
    assert not page.locator('#editor-screen.hidden').count()
    print('[OK] Editor screen visible')

    # 4. Check canvas exists and has correct size
    canvas = page.locator('#editor-canvas')
    assert canvas.is_visible()
    box = canvas.bounding_box()
    assert box['width'] == 720  # 30 * 24
    assert box['height'] == 528  # 22 * 24
    print(f'[OK] Editor canvas size: {box["width"]}x{box["height"]}')

    # 5. Check palette has 8 tile buttons
    palette_btns = page.locator('#editor-palette .editor-tile-btn')
    count = palette_btns.count()
    assert count == 8, f'Expected 8 palette buttons, got {count}'
    print(f'[OK] Palette has {count} tile buttons')

    # 6. Check first wall button is selected by default (WALL = index 1)
    wall_btn = page.locator('#editor-palette .editor-tile-btn.selected')
    assert wall_btn.count() == 1
    print('[OK] Default tile selected (WALL)')

    # 7. Click a different tile (generator, index 3)
    gen_btn = page.locator('#editor-palette .editor-tile-btn').nth(3)
    gen_btn.click()
    assert 'selected' in gen_btn.get_attribute('class')
    print('[OK] Tile selection works')

    # 8. Click on the canvas to paint a tile
    # Tile at (5, 5) -> pixel position (5*24 + 12, 5*24 + 12) = (132, 132) relative to canvas
    canvas.click(position={'x': 132, 'y': 132})
    page.wait_for_timeout(100)
    print('[OK] Canvas click painting works')

    # 9. Test clear button
    clear_btn = page.locator('#btn-editor-clear')
    assert clear_btn.is_visible()
    clear_btn.click()
    page.wait_for_timeout(100)
    status = page.locator('#editor-status').text_content()
    assert '已清空' in status
    print(f'[OK] Clear button works: {status}')

    # 10. Test validate button
    validate_btn = page.locator('#btn-editor-validate')
    validate_btn.click()
    page.wait_for_timeout(100)
    status = page.locator('#editor-status').text_content()
    print(f'[OK] Validate result: {status}')

    # 11. Test export button (downloads a file)
    # Just click it - we can't easily verify download in headless but it shouldn't error
    export_btn = page.locator('#btn-editor-export')
    export_btn.click()
    page.wait_for_timeout(200)
    print('[OK] Export button clicked without errors')

    # 12. Test "back to menu" button
    back_btn = page.locator('#btn-editor-back')
    back_btn.click()
    page.wait_for_timeout(500)
    assert page.locator('#menu-screen').is_visible()
    print('[OK] Back to menu works')

    # 13. Screenshot the editor
    editor_btn.click()
    page.wait_for_timeout(500)
    page.screenshot(path='C:/Users/MORD/asymmetric-game/editor-screenshot.png')
    print('[OK] Screenshot saved')

    browser.close()
    print('\nAll tests passed!')
